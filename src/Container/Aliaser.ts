import AliaserContract from '../Contracts/Container/Aliaser';
import Container from './Container';
import LogicError from './LogicError';
import {Identifier} from '../types/container';

class Aliaser implements AliaserContract {

    /**
     * The underlying container instance.
     *
     * @var {Container}
     */
    protected _container: Container;

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
     * Create a new class binding builder.
     *
     * @constructor
     * @param {Container} container
     */
    public constructor(container: Container) {
        this._container = container;
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
     * Alias a type to a different name.
     *
     * @param {Identifier} abstract
     * @param {Identifier} alias
     *
     * @throws {LogicError}
     * @returns {void}
     */
    public alias<U, V>(abstract: Identifier<U>, alias: Identifier<V>): void {
        if (alias === abstract) {
            throw new LogicError(`[${String(abstract)}] is aliased to itself.`);
        }

        this._aliases.set(alias, abstract);

        this._abstractAliases.has(abstract)
            // eslint-disable-next-line  @typescript-eslint/no-non-null-assertion
            ? this._abstractAliases.get(abstract)!.push(alias)
            : this._abstractAliases.set(abstract, [alias]);
    }

    /**
     * Get the alias for an abstract if available.
     *
     * @param {Identifier} abstract
     * @returns {Identifier}
     */
    public getAlias<T>(abstract: Identifier<T>): Identifier<any> {
        if (!this._aliases.has(abstract)) {
            return abstract;
        }

        return this.getAlias<T>(this._aliases.get(abstract));
    }

    /**
     * Delete the type alias for the given abstract.
     *
     * @param {Identifier} abstract
     * @returns {void}
     */
    public forgetAlias<T>(abstract: Identifier<T>): void {
        this._aliases.delete(abstract);
    }

    /**
     * Clear all the type aliases.
     *
     * @returns {void}
     */
    public forgetAliases(): void {
        this._aliases.clear();
    }

    /**
     * Clear all the aliases keyed by the abstract name.
     *
     * @returns {void}
     */
    public forgetAbstractAliases(): void {
        this._abstractAliases.clear();
    }

    /**
     * Remove an alias from the contextual binding alias cache.
     *
     * @param {Identifier} searched
     * @returns {void}
     */
    public removeAbstractAlias<T>(searched: Identifier<T>): void {
        if (!this._aliases.has(searched)) return;

        this._abstractAliases.forEach((aliases: any[], abstract: any): void => {
            this._abstractAliases.set(
                abstract,
                aliases.filter((alias: any): boolean => alias !== searched)
            );
        });
    }

    /**
     * Determine if the registered alias keyed by the given abstract name
     * exists.
     *
     * @param {Identifier} abstract
     * @returns {boolean}
     */
    public hasAbstractAlias<T>(abstract: Identifier<T>): boolean {
        return this._abstractAliases.has(abstract);
    }

    /**
     * Get the registered alias keyed by the given abstract name.
     *
     * @param {Identifier} abstract
     * @returns {(Array|undefined)}
     */
    public getAbstractAlias<T>(abstract: Identifier<T>): any[] | undefined {
        return this._abstractAliases.get(abstract);
    }

}

export default Aliaser;
