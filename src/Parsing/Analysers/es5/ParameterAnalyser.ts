import AbstractParameterAnalyser from '../AbstractParameterAnalyser';
import ParameterAnalyserContract from '../../../Contracts/Parsing/ParameterAnalyser';
import ParsingError from '../../ParsingError';
import {isUndefined} from '../../../Support/helpers';
import {Param} from '../../../types/estree';

class ParameterAnalyser extends AbstractParameterAnalyser implements ParameterAnalyserContract {

    /**
     * The block statement belonging to the function that owns the parameters.
     *
     * @var {Object}
     */
    private _block: any;

    /**
     * Create a new parameter parser instance.
     *
     * @constructor
     * @param {Object} ast
     * @param {BlockStatement} block
     * @param {*} target
     * @param {(string|undefined)} name
     */
    public constructor(ast: any, block: any, target: any, name?: string) {
        if (block.type !== 'BlockStatement') {
            throw new ParsingError('Invalid parameter AST provided.');
        }

        super(ast, target, name);

        this._block = block;
    }

    /**
     * Find the assignment expression for the given parameter (if it exists).
     *
     * @param {Object} param
     * @returns {(AssignmentExpression|undefined)}
     */
    protected _findAssignment(param: Param): any {
        const statements = this._block.body
            .filter((_: any): boolean => _.type === 'IfStatement');

        for (const statement of statements) {
            const expression = this._filterConsequentBody(
                statement.consequent.body, param
            );

            if (!isUndefined(expression)) return expression;
        }
    }

    /**
     * Filter the body property of a consequent property in an attempt to find
     * the assignment expression that corresponds to the given parameter.
     *
     * @param {Array} body
     * @param {Object} param
     * @returns {(AssignmentExpression|undefined)}
     */
    private _filterConsequentBody(body: any, param: Param): any {
        for (const statement of body) {
            if (statement.expression.type === 'AssignmentExpression'
                && statement.expression.left.name === param.name) {
                return statement.expression;
            }
        }
    }

}

export default ParameterAnalyser;
