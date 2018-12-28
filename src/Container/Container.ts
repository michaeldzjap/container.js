import Arr from '../Support/Arr';
import BindingError from './BindingError';
import BindingResolutionError from './BindingResolutionError';
import BoundMethod from './BoundMethod';
import Callable from './Callable';
import ContextualBindingBuilder from './ContextualBindingBuilder';
import EntryNotFoundError from './EntryNotFoundError';
import IContainer from '../Contracts/Container/IContainer';
import LogicError from './LogicError';
import NestedMap from '../Support/NestedMap/.';
import ReflectionClass from '../Reflection/ReflectionClass';
import ReflectionParameter from '../Reflection/ReflectionParameter';
import {Binding, Identifier, Instantiable} from '../Support/types';
import {
    isString, isNullOrUndefined, isUndefined, getSymbolName, isInstance,
    isInstantiable, equals
} from '../Support/helpers';

class Container implements IContainer {

    /**
     * The current globally available container (if any).
     *
     * @var {Container}
     */
    protected static _instance?: Container;

    /**
     * The contextual binding map.
     *
     * @var {Map}
     */
    public _contextual: any = new NestedMap;

    /**
     * An array of the types that have been resolved.
     *
     * @var {Map}
     */
    protected _resolved: Map<any, boolean> = new Map;

    /**
     * The container's bindings.
     *
     * @var {Map}
     */
    protected _bindings: Map<any, Binding> = new Map;

    /**
     * The container's method bindings.
     *
     * @var {Map}
     */
    protected _methodBindings: Map<string, Function> = new Map;

    /**
     * The container's shared instances.
     *
     * @var {Map}
     */
    protected _instances: Map<any, any> = new Map;

    /**
     * The registered type aliases.
     *
     * @var {Map}
     */
    protected _aliases: Map<any, any> = new Map;

    /**
     * The registered aliases keyed by the abstract name.
     *
     * @var {Map}
     */
    protected _abstractAliases: Map<any, any[]> = new Map;

    /**
     * The extension closures for services.
     *
     * @var {Map}
     */
    protected _extenders: Map<any, Function[]> = new Map;

    /**
     * All of the registered tags.
     *
     * @var {Map}
     */
    protected _tags: Map<string, any[]> = new Map;

    /**
     * The stack of concretions currently being built.
     *
     * @var {*[]}
     */
    protected _buildStack: any[] = [];

    /**
     * The parameter override stack.
     *
     * @var {(*|Object)[]}
     */
    protected _with: Array<any[] | object> = [];

    /**
     * All of the registered rebound callbacks.
     *
     * @var {Map}
     */
    protected _reboundCallbacks: Map<any, Function[]> = new Map;

    /**
     * All of the global resolving callbacks.
     *
     * @var {Function[]}
     */
    protected _globalResolvingCallbacks: Function[] = [];

    /**
     * All of the global after resolving callbacks.
     *
     * @var {Function[]}
     */
    protected _globalAfterResolvingCallbacks: Function[] = [];

    /**
     * All of the resolving callbacks by class type.
     *
     * @var {Map}
     */
    protected _resolvingCallbacks: Map<any, Function[]> = new Map;

    /**
     * All of the after resolving callbacks by class type.
     *
     * @var {Map}
     */
    protected _afterResolvingCallbacks: Map<any, Function[]> = new Map;

    /**
     * Set the globally available instance of the container.
     *
     * @returns {Container}
     */
    public static getInstance(): Container {
        if (!Container._instance) {
            Container._instance = new Container;
        }

        return Container._instance;
    }

    /**
     * Set the shared instance of the container.
     *
     * @param {(Container|undefined)} container
     * @returns {(Container|undefined)}
     */
    public static setInstance(container?: Container): Container | undefined {
        return (Container._instance = container);
    }

    /**
     * Format the name of the given concrete.
     *
     * @param {*} concrete
     * @returns {string}
     */
    private static _formatName<T>(concrete: T): string {
        if (typeof concrete === 'symbol') {
            return getSymbolName(concrete);
        }

        if (isInstantiable(concrete)) {
            return concrete.name;
        }

        if (isInstance(concrete)) {
            return concrete.constructor.name;
        }

        return 'undefined';
    }

    /**
     * Define a contextual binding.
     *
     * @param {(Instantiable[]|Instantiable)} concrete
     * @returns {ContextualBindingBuilder}
     */
    public when<T>(concrete: Instantiable<T>[] | Instantiable<T>): ContextualBindingBuilder {
        const aliases = [];

        for (const c of Arr.wrap(concrete)) {
            aliases.push(this.getAlias<T>(c));
        }

        return new ContextualBindingBuilder(this, aliases);
    }

    /**
     * Determine if the given abstract type has been bound.
     *
     * @param {Identifier} abstract
     * @returns {boolean}
     */
    public bound<T>(abstract: Identifier<T>): boolean {
        return this._bindings.has(abstract) || this._instances.has(abstract)
            || this.isAlias<T>(abstract);
    }

    /**
     * Returns true if the container can return an entry for the given
     * identifier. Returns false otherwise.
     *
     * @param {Identifier} id
     * @returns {boolean}
     */
    public has<T>(id: Identifier<T>): boolean {
        return this.bound<T>(id);
    }

    /**
     * Determine if the given abstract type has been resolved.
     *
     * @param {Identifier} abstract
     * @returns {boolean}
     */
    public resolved<T>(abstract: Identifier<T>): boolean {
        if (this.isAlias<T>(abstract)) {
            abstract = this.getAlias<T>(abstract);
        }

        return this._resolved.has(abstract) || this._instances.has(abstract);
    }

    /**
     * Determine if a given type is shared.
     *
     * @param {Identifier} abstract
     * @returns {boolean}
     */
    public isShared<T>(abstract: Identifier<T>): boolean {
        return this._instances.has(abstract)
            || (this._bindings.has(abstract)
                && this._bindings.get(abstract)!.shared);
    }

    /**
     * Determine if a given string is an alias.
     *
     * @param {Identifier} name
     * @returns {boolean}
     */
    public isAlias<T>(name: Identifier<T>): boolean {
        return this._aliases.has(name);
    }

    /**
     * Register a binding with the container.
     *
     * @param {Identifier} abstract
     * @param {?(Identifier|Function|undefined)} concrete
     * @param {boolean} [shared=false]
     * @returns {void}
     */
    public bind<U, V>(abstract: Identifier<U>, concrete?: Instantiable<V> | Function,
        shared: boolean = false): void {
        // If no concrete type was given, we will simply set the concrete type
        // to the abstract type. After that, the concrete type to be registered
        // as shared without being forced to state their classes in both of the
        // parameters.
        this._dropStaleInstances<U>(abstract);

        if (isNullOrUndefined(concrete) && isInstantiable(abstract)) {
            concrete = abstract as unknown as Instantiable<V>;
        } else if (isNullOrUndefined(concrete)) {
            throw new BindingError('Cannot bind a non-instantiable to itself.');
        }

        // If the factory is not a Closure, it means it is just a class name
        // which is bound into this container to the abstract type and we will
        // just wrap it up inside its own Closure to give us more convenience
        // when extending.
        if (isInstantiable(concrete)) {
            concrete = this._getClosure<U, V>(abstract, concrete);
        }

        this._bindings.set(abstract, {concrete, shared});

        // If the abstract type was already resolved in this container we'll
        // fire the rebound listener so that any objects which have already
        // gotten resolved can have their copy of the object updated via the
        // listener callbacks.
        if (this.resolved<U>(abstract)) this._rebound<U>(abstract);
    }

    /**
     * Unregister a binding with the container.
     *
     * @param {Identifier} abstract
     * @returns {void}
     */
    public unbind<T>(abstract: Identifier<T>): void {
        this._bindings.delete(abstract);
        this._instances.delete(abstract);
        this._resolved.delete(abstract);
    }

    /**
     * Determine if the container has a method binding.
     *
     * @param {string} method
     * @returns {boolean}
     */
    public hasMethodBinding(method: string): boolean {
        return !!this._methodBindings.has(method);
    }

    /**
     * Bind a callback to resolve with Container::call.
     *
     * @param {(Array|string)} method
     * @param {Function} callback
     * @returns {void}
     */
    public bindMethod<T>(method: [Instantiable<T>, string] | string, callback: Function): void {
        this._methodBindings.set(this._parseBindMethod(method), callback);
    }

    /**
     * Get the method binding for the given method.
     *
     * @param {string} method
     * @param {*} instance
     * @returns {*}
     */
    public callMethodBinding(method: string, instance: any): any {
        return (this._methodBindings as any).get(method)(instance, this);
    }

    /**
     * Add a contextual binding to the container.
     *
     * @param {*} concrete
     * @param {Identifier} abstract
     * @param {*} implementation
     * @returns {void}
     */
    public addContextualBinding<T>(concrete: any, abstract: Identifier<T>,
        implementation: any): void {
        this._contextual.set(
            [concrete, this.getAlias<T>(abstract)],
            implementation
        );
    }

    /**
     * Register a binding if it hasn't already been registered.
     *
     * @param {Identifier} abstract
     * @param {(Instantiable|Function|undefined)} concrete
     * @param {boolean} [shared=false]
     * @returns {void}
     */
    public bindIf<U, V>(abstract: Identifier<U>, concrete?: Instantiable<V> | Function,
        shared: boolean = false): void {
        if (!this.bound<U>(abstract)) {
            this.bind<U, V>(abstract, concrete, shared);
        }
    }

    /**
     * Register a shared binding in the container.
     *
     * @param {Identifier} abstract
     * @param {(Instantiable|Function|undefined)} concrete
     * @returns {void}
     */
    public singleton<U, V>(abstract: Identifier<U>, concrete?: Instantiable<V> | Function): void {
        this.bind<U, V>(abstract, concrete, true);
    }

    /**
     * "Extend" an abstract type in the container.
     *
     * @param {Identifier} abstract
     * @param {Function} closure
     * @returns {void}
     */
    public extend<T>(abstract: Identifier<T>, closure: Function): void {
        abstract = this.getAlias<T>(abstract);

        if (this._instances.has(abstract)) {
            this._instances.set(
                abstract, closure(this._instances.get(abstract), this)
            );

            this._rebound<T>(abstract);
        } else {
            this._extenders.has(abstract)
                ? this._extenders.get(abstract)!.push(closure)
                : this._extenders.set(abstract, [closure]);

            if (this.resolved<T>(abstract)) this._rebound<T>(abstract);
        }
    }

    /**
     * Register an existing instance as shared in the container.
     *
     * @param {Identifier} abstract
     * @param {*} instance
     * @returns {*}
     */
    public instance<U, V>(abstract: Identifier<U>, instance: V): V {
        this._removeAbstractAlias<U>(abstract);

        const isBound = this.bound<U>(abstract);

        this._aliases.delete(abstract);

        // We'll check to determine if this type has been bound before, and if
        // it has we will fire the rebound callbacks registered with the
        // container and it can be updated with consuming classes that have
        // gotten resolved here.
        this._instances.set(abstract, instance);

        if (isBound) {
            this._rebound<U>(abstract);
        }

        return instance;
    }

    /**
     * Assign a set of tags to a given binding.
     *
     * @param {(Identifier[]|Identifier)} abstracts
     * @param {string[]} tags
     * @returns {void}
     */
    public tag<T>(abstracts: Identifier<T>[] | Identifier<T>, tags: string[]): void {
        for (const tag of tags) {
            if (!this._tags.has(tag)) this._tags.set(tag, []);

            for (const abstract of Arr.wrap(abstracts)) {
                this._tags.get(tag)!.push(abstract);
            }
        }
    }

    /**
     * Resolve all of the bindings for a given tag.
     *
     * @param {string} tag
     * @returns {*[]}
     */
    public tagged(tag: string): any[] {
        const results: any[] = [];

        if (this._tags.has(tag)) {
            for (const abstract of (this._tags as any).get(tag)) {
                results.push(this.make(abstract));
            }
        }

        return results;
    }

    /**
     * Alias a type to a different name.
     *
     * @param {Identifier} abstract
     * @param {Identifier} alias
     * @returns {void}
     */
    public alias<U, V>(abstract: Identifier<U>, alias: Identifier<V>): void {
        this._aliases.set(alias, abstract);

        const arr = this._abstractAliases.get(abstract);
        this._abstractAliases.set(
            abstract,
            arr ? [...arr, alias] : [alias]
        );
    }

    /**
     * Bind a new callback to an abstract's rebind event.
     *
     * @param {Identifier} abstract
     * @param {Function} callback
     * @returns {(*|undefined)}
     */
    public rebinding<T>(abstract: Identifier<T>, callback: Function): unknown | undefined {
        abstract = this.getAlias<T>(abstract);
        this._reboundCallbacks.set(
            abstract,
            this._reboundCallbacks.has(abstract)
                ? [...this._reboundCallbacks.get(abstract) as Function[], callback]
                : [callback]
        );

        if (this.bound<T>(abstract)) return this.make<T>(abstract);
    }

    /**
     * Refresh an instance on the given target and method.
     *
     * @param {Identifier} abstract
     * @param {Object} target
     * @param {string} method
     * @returns {*}
     */
    public refresh<T>(abstract: Identifier<T>, target: object, method: string): unknown {
        return this.rebinding<T>(abstract, (app: unknown, instance: unknown): void => {
            target[method](instance);
        });
    }

    /**
     * Wrap the given closure such that its dependencies will be injected when
     * executed.
     *
     * @param {Callable} callback
     * @param {(*[]|Object)} parameters
     * @returns {Function}
     */
    public wrap<T>(callback: Callable<T>, parameters?: any[] | object): Function {
        return (): unknown => this.call(callback, parameters);
    }

    /**
     * Call the given Closure / class@method and inject its dependencies.
     *
     * @param {Callable} callback
     * @param {(*[]|Object|undefined)} parameters
     * @param {(string|undefined)} defaultMethod
     * @returns {*}
     */
    public call<T>(callback: Callable<T>, parameters?: any[] | object,
        defaultMethod?: string): any {
        return BoundMethod.call<T>(this, callback, parameters, defaultMethod);
    }

    /**
     * Get a closure to resolve the given type from the container.
     *
     * @param {Identifier} abstract
     * @returns {Function}
     */
    public factory<T>(abstract: Identifier<T>): Function {
        return (): unknown => this.make<T>(abstract);
    }

    /**
     * Resolve the given type from the container.
     *
     * @param {Identifier} abstract
     * @param {(*[]|Object)} [parameters=[]]
     * @returns {*}
     */
    public make<T>(abstract: Identifier<T>, parameters: any[] | object = []): any {
        return this._resolve<T>(abstract, parameters);
    }

    /**
     * Finds an entry of the container by its identifier and returns it.
     *
     * @param {Identifier} id
     * @returns {*}
     *
     * @throws {EntryNotFoundError}
     */
    public get<T>(id: Identifier<T>): any {
        try {
            return this._resolve<T>(id);
        } catch (e) {
            if (this.has(id)) throw e;

            throw new EntryNotFoundError;
        }
    }

    /**
     * Set (bind) a new entry of the container by its identifier.
     *
     * @param {Identifier} id
     * @param {*} value
     * @returns {void}
     */
    public set<U, V>(id: Identifier<U>, value: V): void {
        this.bind(
            id,
            value instanceof Function && !isInstantiable(value)
                ? value
                : (): any => value
        );
    }

    /**
     * Instantiate a concrete instance of the given type.
     *
     * @param {(Identifier|Function)} concrete
     * @returns {*}
     */
    public build<T>(concrete: Instantiable<T> | Function): any {
        // If the concrete type is actually a Closure, we will just execute it
        // and hand back the results of the functions, which allows functions
        // to be used as resolvers for more fine-tuned resolution of these
        // objects.
        if (!isInstantiable(concrete) && concrete instanceof Function) {
            return concrete(this, this._getLastParameterOverride());
        }

        const reflector = typeof concrete === 'symbol'
            ? ReflectionClass.createFromInterface(concrete)
            : new ReflectionClass(concrete);

        // If the type is not instantiable, the developer is attempting to
        // resolve an abstract type such as an Interface of Abstract Class and
        // there is no binding registered for the abstractions so we need to
        // bail out.
        if (!reflector.isInstantiable()) {
            this._notInstantiable(concrete);
        }

        this._buildStack.push(concrete);

        const dependencies = reflector.getConstructor().getParameters();

        // If there are no constructor parameters, that means there are no
        // dependencies then we can just resolve the instances of the objects
        // right away, without resolving any other types or dependencies out of
        // these containers.
        if (!dependencies.length) {
            this._buildStack.pop();

            return new (concrete as any);
        }

        // Once we have all the constructor's parameters we can create each of
        // the dependency instances and then use the reflection instances to
        // make a new instance of this class, injecting the created dependencies
        // in.
        const instances = this._resolveDependencies(dependencies);

        this._buildStack.pop();

        return reflector.newInstanceArgs(instances);
    }

    /**
     * Register a new resolving callback.
     *
     * @param {(Identifier|Function)} abstract
     * @param {(Function|undefined)} callback
     * @returns {void}
     */
    public resolving<T>(abstract: Identifier<T> | Function, callback?: Function): void {
        if (isString(abstract) || isInstantiable(abstract)) {
            abstract = this.getAlias<T>(abstract);
        }

        if (isUndefined(callback) && !isInstantiable(abstract)
            && abstract instanceof Function) {
            this._globalResolvingCallbacks.push(abstract);
        } else if (!isUndefined(callback)) {
            this._resolvingCallbacks.has(abstract)
                ? this._resolvingCallbacks.get(abstract)!.push(callback)
                : this._resolvingCallbacks.set(abstract, [callback]);
        }
    }

    /**
     * Register a new after resolving callback for all types.
     *
     * @param {(Identifier|Function)} abstract
     * @param {(Function|undefined)} callback
     * @returns {void}
     */
    public afterResolving<T>(abstract: Identifier<T>| Function, callback?: Function): void {
        if (isString(abstract) || isInstantiable(abstract)) {
            abstract = this.getAlias<T>(abstract);
        }

        if (isUndefined(callback) && !isInstantiable(abstract)
            && abstract instanceof Function) {
            this._globalAfterResolvingCallbacks.push(abstract);
        } else if (!isUndefined(callback)) {
            this._afterResolvingCallbacks.has(abstract)
                ? this._afterResolvingCallbacks.get(abstract)!.push(callback)
                : this._afterResolvingCallbacks.set(abstract, [callback]);
        }
    }

    /**
     * Get the container's bindings.
     *
     * @returns {Map}
     */
    public getBindings(): Map<any, Binding> {
        return this._bindings;
    }

    /**
     * Get the alias for an abstract if available.
     *
     * @param {Identifier} abstract
     * @returns {Identifier}
     *
     * @throws {LogicError}
     */
    public getAlias<T>(abstract: Identifier<T>): Identifier<any> {
        if (!this._aliases.has(abstract)) {
            return abstract;
        }

        if (this._aliases.get(abstract) === abstract) {
            throw new LogicError(`[${String(abstract)}] is aliased to itself.`);
        }

        return this.getAlias<T>(this._aliases.get(abstract));
    }

    /**
     * Remove all of the extender callbacks for a given type.
     *
     * @param {Identifier} abstract
     * @returns {void}
     */
    public forgetExtenders<T>(abstract: Identifier<T>): void {
        this._extenders.delete(this.getAlias(abstract));
    }

    /**
     * Remove a resolved instance from the instance cache.
     *
     * @param {Identifier} abstract
     * @returns {void}
     */
    public forgetInstance<T>(abstract: Identifier<T>): void {
        this._instances.delete(abstract);
    }

    /**
     * Clear all of the instances from the container.
     *
     * @returns {void}
     */
    public forgetInstances(): void {
        this._instances.clear();
    }

    /**
     * Flush the container of all bindings and resolved instances.
     *
     * @returns {void}
     */
    public flush(): void {
        this._aliases.clear();
        this._resolved.clear();
        this._bindings.clear();
        this._instances.clear();
        this._abstractAliases.clear();
    }

    /**
     * Get the Closure to be used when building a type.
     *
     * @param {Identifier} abstract
     * @param {Identifier} concrete
     * @returns {Function}
     */
    protected _getClosure<U, V>(abstract: Identifier<U>, concrete: Instantiable<V>): Function {
        return (container: Container, parameters: Map<string, any> = new Map): unknown => {
            if (equals(abstract, concrete)) {
                return container.build<V>(concrete);
            }

            return container.make(concrete, parameters);
        };
    }

    /**
     * Get the method to be bound in class@method format.
     *
     * @param {(Array|string)} method
     * @returns {string}
     */
    protected _parseBindMethod<T>(method: [Instantiable<T>, string] | string): string {
        if (Array.isArray(method)) {
            return `${method[0].name}@${method[1]}`;
        }

        return method;
    }

    /**
     * Remove an alias from the contextual binding alias cache.
     *
     * @param {Identifier} searched
     * @returns {void}
     */
    protected _removeAbstractAlias<T>(searched: Identifier<T>): void {
        if (!this._aliases.has(searched)) return;

        this._abstractAliases.forEach((aliases: any[], abstract: any): void => {
            this._abstractAliases.set(
                abstract,
                aliases.filter((alias: any): boolean => alias !== searched)
            );
        });
    }

    /**
     * Fire the "rebound" callbacks for the given abstract type.
     *
     * @param {Identifier} abstract
     * @returns {void}
     */
    protected _rebound<T>(abstract: Identifier<T>): void {
        const instance = this.make<T>(abstract);

        for (const callback of this._getReboundCallbacks<T>(abstract)) {
            callback(this, instance);
        }
    }

    /**
     * Get the rebound callbacks for a given type.
     *
     * @param {Identifier} abstract
     * @returns {Function[]}
     */
    protected _getReboundCallbacks<T>(abstract: Identifier<T>): Function[] {
        if (this._reboundCallbacks.has(abstract)) {
            return this._reboundCallbacks.get(abstract) as Function[];
        }

        return [];
    }

    /**
     * Resolve the given type from the container.
     *
     * @param {Identifier} abstract
     * @param {(*[]|Object)} [parameters=[]]
     * @returns {*}
     */
    protected _resolve<T>(abstract: Identifier<T>, parameters: any[] | object = []): any {
        abstract = this.getAlias<T>(abstract);

        const needsContextualBuild = !Arr.empty(parameters)
            || !!this._getContextualConcrete<T>(abstract);

        // If an instance of the type is currently being managed as a singleton
        // we'll just return an existing instance instead of instantiating new
        // instances so the developer can keep using the same objects instance
        // every time.
        if (this._instances.has(abstract) && !needsContextualBuild) {
            return this._instances.get(abstract);
        }

        this._with.push(parameters);

        const concrete = this._getConcrete<T>(abstract);

        // We're ready to instantiate an instance of the concrete type
        // registered for the binding. This will instantiate the types, as well
        // as resolve any of its "nested" dependencies recursively until all
        // have gotten resolved.
        let object = this._isBuildable<any, T>(concrete, abstract)
            ? this.build<any>(concrete)
            : this.make<any>(concrete);

        // If we defined any extenders for this type, we'll need to spin through
        // them and apply them to the object being built. This allows for the
        // extension of services, such as changing configuration or decorating
        // the object.
        for (const extender of this._getExtenders<T>(abstract)) {
            object = extender(object, this);
        }

        // If the requested type is registered as a singleton we'll want to
        // cache off the instances in "memory" so we can return it later without
        // creating an entirely new instance of an object on each subsequent
        // request for it.
        if (this.isShared<T>(abstract) && !needsContextualBuild) {
            this._instances.set(abstract, object);
        }

        this._fireResolvingCallbacks<T>(abstract, object);

        // Before returning, we will also set the resolved flag to "true" and
        // pop off the parameter overrides for this build. After those two
        // things are done we will be ready to return back the fully constructed
        // class instance.
        this._resolved.set(abstract, true);

        this._with.pop();

        return object;
    }

    /**
     * Get the concrete type for a given abstract.
     *
     * @param {Identifier} abstract
     * @returns {*}
     */
    protected _getConcrete<T>(abstract: Identifier<T>): Identifier<T> | any {
        const concrete = this._getContextualConcrete<T>(abstract);
        if (!isUndefined(concrete)) return concrete;

        // If we don't have a registered resolver or concrete for the type,
        // we'll just assume each type is a concrete name and will attempt to
        // resolve it as is since the container should be able to resolve
        // concretes automatically.
        if (this._bindings.has(abstract)) {
            return this._bindings.get(abstract)!.concrete;
        }

        return abstract;
    }

    /**
     * Get the contextual concrete binding for the given abstract.
     *
     * @param {Identifier} abstract
     * @returns {*}
     */
    protected _getContextualConcrete<T>(abstract: Identifier<T>): any {
        const binding = this._findInContextualBindings(abstract);
        if (!isUndefined(binding)) return binding;

        // Next we need to see if a contextual binding might be bound under an
        // alias of the given abstract type. So, we will need to check if any
        // aliases exist with this type and then spin through them and check for
        // contextual bindings on these.
        if (!this._abstractAliases.has(abstract)
            || (this._abstractAliases.has(abstract)
                && !this._abstractAliases.get(abstract)!.length)) {
            return;
        }

        for (const alias of this._abstractAliases.get(abstract) as any[]) {
            const binding = this._findInContextualBindings<any>(alias);
            if (!isUndefined(binding)) return binding;
        }
    }

    /**
     * Find the concrete binding for the given abstract in the contextual
     * binding array.
     *
     * @param {Identifier} abstract
     * @returns {*}
     */
    protected _findInContextualBindings<T>(abstract: Identifier<T>): any {
        if (this._contextual.has([Arr.last(this._buildStack), abstract])) {
            return this._contextual.get([Arr.last(this._buildStack), abstract]);
        }
    }

    /**
     * Determine if the given concrete is buildable.
     *
     * @param {(Identifier|*)} concrete
     * @param {Identifier} abstract
     * @returns {boolean}
     */
    protected _isBuildable<U, V>(concrete: Identifier<U> | Function,
        abstract: Identifier<V>): boolean {
        return equals(concrete, abstract)
            || (!isInstantiable(concrete) && concrete instanceof Function);
    }

    /**
     * Resolve all of the dependencies from the ReflectionParameters.
     *
     * @param {ReflectionParameter[]} dependencies
     * @returns {*[]}
     */
    protected _resolveDependencies(dependencies: ReflectionParameter[]): any[] {
        const results = [];

        for (const dependency of dependencies) {
            // If this dependency has a override for this particular build we
            // will use that instead as the value. Otherwise, we will continue
            // with this run of resolutions and let reflection attempt to
            // determine the result.
            if (this._hasParameterOverride(dependency)) {
                results.push(this._getParameterOverride(dependency));

                continue;
            }

            // If the class is null, it means the dependency is a string or some
            // class and we will just bomb out with an error since we have
            // no-where to go.
            results.push(
                dependency.getType().isBuiltin()
                    ? this._resolvePrimitive(dependency)
                    : this._resolveClass(dependency)
            );
        }

        return results;
    }

    /**
     * Determine if the given dependency has a parameter override.
     *
     * @param {ReflectionParameter} dependency
     * @returns {boolean}
     */
    protected _hasParameterOverride(dependency: ReflectionParameter): boolean {
        const override = this._getLastParameterOverride();

        return Array.isArray(override)
            ? false
            : override.hasOwnProperty(dependency.getName());
    }

    /**
     * Get a parameter override for a dependency.
     *
     * @param {ReflectionParameter} dependency
     * @returns {*}
     */
    protected _getParameterOverride(dependency: ReflectionParameter): any {
        return this._getLastParameterOverride()[dependency.getName()];
    }

    /**
     * Get the last parameter override.
     *
     * @returns {(*[]|Object)}
     */
    protected _getLastParameterOverride(): any[] | object {
        return this._with.length ? Arr.last(this._with) : [];
    }

    /**
     * Resolve a non-class hinted primitive dependency.
     *
     * @param {ReflectionParameter} parameter
     * @returns {(*|undefined)}
     */
    protected _resolvePrimitive(parameter: ReflectionParameter): any | undefined {
        const concrete = this._getContextualConcrete(parameter.getName());
        if (concrete) {
            return concrete instanceof Function
                ? concrete(this)
                : concrete;
        }

        if (parameter.isDefaultValueAvailable()) {
            return parameter.getDefaultValue();
        }

        this._unresolvablePrimitive(parameter);
    }

    /**
     * Resolve a class based dependency from the container.
     *
     * @param {ReflectionParameter} parameter
     * @returns {*}
     *
     * @throws {BindingResolutionError}
     */
    protected _resolveClass(parameter: ReflectionParameter): any {
        const reflector = parameter.getClass();

        if (isUndefined(reflector)) {
            throw new BindingResolutionError('Cannot get parameter type.');
        }

        try {
            const target = reflector.getTarget();

            return this.make(reflector.isInterface() ? target.key : target);
        } catch (e) {
            // If we can not resolve the class instance, we will check to see if
            // the value is optional, and if it is we will return the optional
            // parameter value as the value of the dependency, similarly to how
            // we do this with scalars.
            if (e instanceof BindingResolutionError
                && parameter.isDefaultValueAvailable()) {
                return parameter.getDefaultValue();
            }

            throw e;
        }
    }

    /**
     * Throw an exception that the concrete is not instantiable.
     *
     * @param {*} concrete
     * @returns {void}
     *
     * @throws {BindingResolutionError}
     */
    protected _notInstantiable<T>(concrete: T): void {
        let message = `Target [${Container._formatName(concrete)}] is not instantiable`;

        if (this._buildStack.length) {
            const previous = this._buildStack
                .map((_: any): string => _.name)
                .join(', ');

            message += ` while building [${previous}].`;
        } else {
            message += '.';
        }

        throw new BindingResolutionError(message);
    }

    /**
     * Throw an exception for an unresolvable primitive.
     *
     * @param {ReflectionParameter} parameter
     * @returns {void}
     *
     * @throws {BindingResolutionError}
     */
    protected _unresolvablePrimitive(parameter: ReflectionParameter): void {
        const message = `Unresolvable dependency resolving [${parameter.getName()}] in class ${(parameter.getDeclaringClass() as any).getName()}`;

        throw new BindingResolutionError(message);
    }

    /**
     * Fire all of the resolving callbacks.
     *
     * @param {Identifier} abstract
     * @param {Object} object
     * @returns {void}
     */
    protected _fireResolvingCallbacks<T>(abstract: Identifier<T>,
        object: object): void {
        if (this._globalResolvingCallbacks.length) {
            this._fireCallbackArray(object, this._globalResolvingCallbacks);
        }

        this._resolvingCallbacks.forEach(
            (callbacks: Function[], type: any): void => {
                if (type === abstract || object instanceof type) {
                    this._fireCallbackArray(object, callbacks);
                }
            }
        );

        this._fireAfterResolvingCallbacks<T>(abstract, object);
    }

    /**
     * Fire all of the after resolving callbacks.
     *
     * @param {Identifier} abstract
     * @param {Object} object
     * @returns {void}
     */
    protected _fireAfterResolvingCallbacks<T>(abstract: Identifier<T>,
        object: object): void {
        if (this._globalAfterResolvingCallbacks.length) {
            this._fireCallbackArray(object, this._globalAfterResolvingCallbacks);
        }

        this._afterResolvingCallbacks.forEach(
            (callbacks: Function[], type: any): void => {
                if (type === abstract || object instanceof type) {
                    this._fireCallbackArray(object, callbacks);
                }
            }
        );
    }

    /**
     * Fire an array of callbacks with an object.
     *
     * @param {Object} object
     * @param {Function[]} callbacks
     * @returns {void}
     */
    protected _fireCallbackArray(object: object, callbacks: Function[]): void {
        for (const callback of callbacks) {
            callback(object, this);
        }
    }

    /**
     * Get the extender callbacks for a given type.
     *
     * @param {Identifier} abstract
     * @returns {Function[]}
     */
    protected _getExtenders<T>(abstract: Identifier<T>): Function[] {
        abstract = this.getAlias<T>(abstract);

        if (this._extenders.has(abstract)) {
            return this._extenders.get(abstract) as Function[];
        }

        return [];
    }

    /**
     * Drop all of the stale instances and aliases.
     *
     * @param {Identifier} abstract
     * @returns {void}
     */
    protected _dropStaleInstances<T>(abstract: Identifier<T>): void {
        this._instances.delete(abstract);
        this._aliases.delete(abstract);
    }

}

export default Container;
