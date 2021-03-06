import {Identifier} from '../../types/container';

interface Extender {

    /**
     * "Extend" an abstract type in the container.
     *
     * @param {Identifier} abstract
     * @param {Function} closure
     * @returns {void}
     */
    extend<T>(abstract: Identifier<T>, closure: Function): void;

}

export default Extender;
