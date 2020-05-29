import { ESLintUtils, TSESTree } from '@typescript-eslint/experimental-utils';
import {
  isIdentifier,
  isCallExpression,
  isMemberExpression,
  isArrowFunctionExpression,
} from '../node-utils';
import { getDocsUrl, SYNC_QUERIES_COMBINATIONS } from '../utils';
import { ReportFixFunction } from '@typescript-eslint/experimental-utils/dist/ts-eslint';

export const RULE_NAME = 'prefer-find-by';

type Options = [];
export type MessageIds = 'preferFindBy';
export const WAIT_METHODS = ['waitFor', 'waitForElement', 'wait']

export default ESLintUtils.RuleCreator(getDocsUrl)<Options, MessageIds>({
  name: RULE_NAME,
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Suggest using find* instead of waitFor to wait for elements',
      category: 'Best Practices',
      recommended: 'warn',
    },
    messages: {
      preferFindBy: 'Prefer {{queryVariant}}{{queryMethod}} method over using await {{fullQuery}}'
    },
    fixable: null,
    schema: []
  },
  defaultOptions: [],

  create(context) {

    function reportInvalidUsage(node: TSESTree.CallExpression, { queryVariant, queryMethod, fullQuery, fix }: { queryVariant: string, queryMethod: string, fullQuery: string, fix: ReportFixFunction }) {
      context.report({
        node,
        messageId: 'preferFindBy',
        data: { queryVariant, queryMethod, fullQuery },
        suggest: [{ messageId: "preferFindBy", fix }]
      });
    }

    const sourceCode = context.getSourceCode();

    return {
      'AwaitExpression > CallExpression'(node: TSESTree.CallExpression) {
        if (!isIdentifier(node.callee) || !WAIT_METHODS.includes(node.callee.name)) {
          return
        }
        // ensure the only argument is an arrow function expression - if the arrow function is a block
        // we skip it
        const argument = node.arguments[0]
        if (!isArrowFunctionExpression(argument)) {
          return
        }
        if (!isCallExpression(argument.body)) {
          return
        }
        // ensure here it's one of the sync methods that we are calling
        if (isMemberExpression(argument.body.callee) && isIdentifier(argument.body.callee.property) && isIdentifier(argument.body.callee.object) && SYNC_QUERIES_COMBINATIONS.includes(argument.body.callee.property.name)) {
          // shape of () => screen.getByText
          const methodCall = argument.body.callee.property.name
          const caller = argument.body.callee.object.name
          const allArguments = argument.body.arguments
          const queryVariant = getFindByQueryVariant(methodCall)
          const queryMethod = methodCall.split('By')[1]
          reportInvalidUsage(node, {
            queryMethod,
            queryVariant,
            fullQuery: sourceCode.getText(node),
            fix: (fixer) => {
              return fixer
                .replaceText(node, `${caller}.${queryVariant}${queryMethod}(${allArguments.map((param) => sourceCode.getText(param)).join(', ')})`)
            }
          })
          return
        }
        if (isIdentifier(argument.body.callee) && SYNC_QUERIES_COMBINATIONS.includes(argument.body.callee.name)) {
          // shape of () => getByText
          const methodCall = argument.body.callee.name
          const allArguments = argument.body.arguments
          const queryVariant = getFindByQueryVariant(methodCall)
          const queryMethod = methodCall.split('By')[1]
          reportInvalidUsage(node, {
            queryMethod,
            queryVariant,
            fullQuery: sourceCode.getText(node),
            fix: (fixer) => {
              return fixer
                .replaceText(node, `${queryVariant}${queryMethod}(${allArguments.map((param) => sourceCode.getText(param)).join(', ')})`)
            }
          })
          return
        }
      }
    }
  }
})

function getFindByQueryVariant(queryMethod: string) {
  return queryMethod.includes('All') ? 'findAllBy' : 'findBy'
}