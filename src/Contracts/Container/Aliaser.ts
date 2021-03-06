import {Identifier} from '../../types/container';

interface Aliaser {

    /**
     * Alias a type to a different name.
     *
     * @param {Identifier} abstract
     * @param {Identifier} alias
     * @returns {void}
     */
    alias<U, V>(abstract: Identifier<U>, alias: Identifier<V>): void;

}

export default Aliaser;
