import ParameterDescriptor from '@src/Parsing/Descriptors/ParameterDescriptor';
import {ReflectionClass, ReflectionType} from '.';
import {isNullOrUndefined, isClass} from '@src/Support/helpers';
import {Interface} from '@typings/.'

class ReflectionParameter {

    /**
     * The target the parameter belongs to.
     *
     * @var mixed
     */
    private _target: any;

    /**
     * The type of the reflected parameter.
     *
     * @var {mixed}
     */
    private _descriptor: ParameterDescriptor;

    /**
     * Create a new reflection parameter instance.
     *
     * @param {mixed} target
     * @param {ParameterDescriptor} descriptor
     * @param {number} position
     */
    public constructor(target: any, descriptor: ParameterDescriptor) {
        this._target = target;
        this._descriptor = descriptor;
    }

    /**
     * Get the class definition for the reflected parameter (if it exists).
     *
     * @returns {ReflectionClass|undefined}
     */
    public getDeclaringClass(): ReflectionClass | undefined {
        if (isClass(this._target)) {
            return new ReflectionClass(this._target);
        }
    }

    /**
     * Get the class type hinted for the reflected parameter.
     *
     * @returns {ReflectionClass|undefined}
     */
    public getClass(): ReflectionClass | undefined {
        if (this.getType().isBuiltin()) return;

        if ((this._descriptor.type as any).name === 'Interface') {
            return ReflectionClass.createFromInterface(
                (this._descriptor.type as unknown as Interface).key
            );
        }

        return new ReflectionClass(this._descriptor.type);
    }

    /**
     * Get the name of the reflected parameter.
     *
     * @returns {string}
     */
    public getName(): string {
        return this._descriptor.name;
    }

    /**
     * Get the type of the reflected parameter.
     *
     * @returns {mixed}
     */
    public getType(): ReflectionType {
        return new ReflectionType(this._descriptor.type);
    }

    /**
     * Get the position of the reflected parameter.
     *
     * @returns {number}
     */
    public getPosition(): number {
        return this._descriptor.position;
    }

    /**
     * Check if the reflected parameter has a default value.
     *
     * @returns {boolean}
     */
    public isDefaultValueAvailable(): boolean {
        return !isNullOrUndefined(this._descriptor.value);
    }

    /**
     * Get the default value of the reflected parameter.
     *
     * @returns {mixed}
     */
    public getDefaultValue(): unknown {
        return this._descriptor.value;
    }

}

export default ReflectionParameter;
