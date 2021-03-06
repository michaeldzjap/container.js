import ParameterDescriptor from '../../Descriptors/ParameterDescriptor';

interface ParameterAnalyser {

    /**
     * Get all the parsed parameters.
     *
     * @returns {ParameterDescriptor[]}
     */
    all(): ParameterDescriptor[];

    /**
     * Get the parsed parameter at the given index.
     *
     * @param {number} index
     * @returns {ParameterDescriptor}
     */
    at(index: number): ParameterDescriptor;

}

export default ParameterAnalyser;
