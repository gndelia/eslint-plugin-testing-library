import { ESLintUtils, TSESTree } from '@typescript-eslint/experimental-utils';
import { getDocsUrl } from '../utils';
import {
  isVariableDeclarator,
  hasThenProperty,
  isCallExpression,
  isIdentifier,
  isMemberExpression,
} from '../node-utils';

export const RULE_NAME = 'await-async-query';
export type MessageIds = 'awaitAsyncQuery';
type Options = [];

const VALID_PARENTS = [
  'AwaitExpression',
  'ArrowFunctionExpression',
  'ReturnStatement',
];

const ASYNC_QUERIES_REGEXP = /^find(All)?By(LabelText|PlaceholderText|Text|AltText|Title|DisplayValue|Role|TestId)$/;

function isAwaited(node: TSESTree.Node) {
  return VALID_PARENTS.includes(node.type);
}

function isPromiseResolved(node: TSESTree.Node) {
  const parent = node.parent;

  // findByText("foo").then(...)
  if (isCallExpression(parent)) {
    return hasThenProperty(parent.parent);
  }

  // promise.then(...)
  return hasThenProperty(parent);
}

function hasClosestExpectResolvesRejects(node: TSESTree.Node): boolean {
  if (!node.parent) {
    return false;
  }

  if (
    isCallExpression(node) &&
    isIdentifier(node.callee) &&
    isMemberExpression(node.parent) &&
    node.callee.name === 'expect'
  ) {
    const expectMatcher = node.parent.property;
    return (
      isIdentifier(expectMatcher) &&
      (expectMatcher.name === 'resolves' || expectMatcher.name === 'rejects')
    );
  } else {
    return hasClosestExpectResolvesRejects(node.parent);
  }
}

export default ESLintUtils.RuleCreator(getDocsUrl)<Options, MessageIds>({
  name: RULE_NAME,
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce async queries to have proper `await`',
      category: 'Best Practices',
      recommended: 'warn',
    },
    messages: {
      awaitAsyncQuery: '`{{ name }}` must have `await` operator',
    },
    fixable: null,
    schema: [],
  },
  defaultOptions: [],

  create(context) {
    const testingLibraryQueryUsage: TSESTree.Identifier[] = [];
    return {
      [`CallExpression > Identifier[name=${ASYNC_QUERIES_REGEXP}]`](
        node: TSESTree.Identifier
      ) {
        if (
          !isAwaited(node.parent.parent) &&
          !isPromiseResolved(node) &&
          !hasClosestExpectResolvesRejects(node)
        ) {
          testingLibraryQueryUsage.push(node);
        }
      },
      'Program:exit'() {
        testingLibraryQueryUsage.forEach(node => {
          const variableDeclaratorParent = node.parent.parent;

          const references =
            (isVariableDeclarator(variableDeclaratorParent) &&
              context
                .getDeclaredVariables(variableDeclaratorParent)[0]
                .references.slice(1)) ||
            [];

          if (
            references &&
            references.length === 0 &&
            !isAwaited(node.parent.parent) &&
            !isPromiseResolved(node)
          ) {
            context.report({
              node,
              messageId: 'awaitAsyncQuery',
              data: {
                name: node.name,
              },
            });
          } else {
            for (const reference of references) {
              const referenceNode = reference.identifier;
              if (
                !isAwaited(referenceNode.parent) &&
                !isPromiseResolved(referenceNode)
              ) {
                context.report({
                  node,
                  messageId: 'awaitAsyncQuery',
                  data: {
                    name: node.name,
                  },
                });

                break;
              }
            }
          }
        });
      },
    };
  },
});
