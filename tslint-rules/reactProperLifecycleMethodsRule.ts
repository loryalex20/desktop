/**
 * react-proper-lifecycle-methods
 *
 * This custom tslint rule is attemptsto prevent erroneous usage of the React
 * lifecycle methods by ensuring proper method naming, and parameter order,
 * types and names.
 *
 */

import * as ts from 'typescript'
import * as Lint from 'tslint/lib/lint'

interface IExpectedParameter {
  readonly name: string,
  readonly type: string
}

export class Rule extends Lint.Rules.AbstractRule {
    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
      if (sourceFile.languageVariant === ts.LanguageVariant.JSX) {
        return this.applyWithWalker(new ReactProperLifecycleMethodsWalker(sourceFile, this.getOptions()))
      } else {
          return []
      }
    }
}

class ReactProperLifecycleMethodsWalker extends Lint.RuleWalker {

  private propsTypeName: string
  private stateTypeName: string

  protected visitClassDeclaration(node: ts.ClassDeclaration): void {
    if (node.heritageClauses && node.heritageClauses.length) {
      for (const heritageClause of node.heritageClauses) {
        if (heritageClause.token === ts.SyntaxKind.ExtendsKeyword && heritageClause.types) {
          for (const type of heritageClause.types) {
            const inheritedName = type.expression.getText()

            if (inheritedName === 'React.Component') {
              if (type.typeArguments && type.typeArguments.length === 2) {
                this.propsTypeName = type.typeArguments[0].getText()
                this.stateTypeName = type.typeArguments[1].getText()

                super.visitClassDeclaration(node)
                return
              }
            }
          }
        }
      }
    }
  }

  protected visitMethodDeclaration(node: ts.MethodDeclaration): void {
    const methodName = node.name.getText()
    if (/^component|^shouldComponent/.test(methodName)) {
      switch (methodName) {
        case 'componentWillMount':
        case 'componentDidMount':
        case 'componentWillUnmount':
          return this.verifyEmptyParameters(node)
        case 'componentWillReceiveProps':
          return this.verifyComponentWillReceiveProps(node)
        case 'componentWillUpdate':
          return this.verifyComponentWillUpdate(node)
        case 'componentDidUpdate':
          return this.verifyComponentDidUpdate(node)
        case 'shouldComponentUpdate':
        return this.verifyShouldComponentUpdate(node)
      }
    }
  }

  private verifyEmptyParameters(node: ts.MethodDeclaration) {
    if (node.parameters.length) {
      const start = node.getStart()
      const width = node.getWidth()

      const methodName = node.name.getText()
      const message = `${methodName} should not accept any parameters.`

      this.addFailure(this.createFailure(start, width, message))
    }
  }

  private verifyParameter(node: ts.ParameterDeclaration, expectedParameter: IExpectedParameter): boolean {
    const parameterName = node.name.getText()

    const parameterStart = node.getStart()
    const parameterwidth = node.getWidth()

    if (parameterName !== expectedParameter.name) {
      const message = `parameter should be named ${expectedParameter.name}.`
      this.addFailure(this.createFailure(parameterStart, parameterwidth, message))
      return false
    }

    const parameterTypeName = node.type ? node.type.getText() : undefined

    if (parameterTypeName !== expectedParameter.type) {
      const message = `parameter should be of type ${expectedParameter.type}.`
      this.addFailure(this.createFailure(parameterStart, parameterwidth, message))
      return false
    }

    if (parameterTypeName === 'void') {
      const message = `remove unused void parameter ${parameterName}.`
      this.addFailure(this.createFailure(parameterStart, parameterwidth, message))
      return false
    }

    return true
  }

  private verifyParameters(node: ts.MethodDeclaration, expectedParameters: ReadonlyArray<IExpectedParameter>): boolean {
    // It's okay to omit parameters
    for (let i = 0; i < node.parameters.length; i++) {
      const parameter = node.parameters[i]

      if (i >= expectedParameters.length) {
        console.log(i, expectedParameters.length)
        const parameterName = parameter.getText()
        const parameterStart = parameter.getStart()
        const parameterwidth = parameter.getWidth()
        const message = `unknown parameter ${parameterName}`

        this.addFailure(this.createFailure(parameterStart, parameterwidth, message))
        return false
      }

      if (this.verifyParameter(parameter, expectedParameters[i])) {
        return false
      }
    }

    return true
  }

  private verifyComponentWillReceiveProps(node: ts.MethodDeclaration) {
    this.verifyParameters(node, [ { name: 'nextProps', type: this.propsTypeName } ])
  }

  private verifyComponentWillUpdate(node: ts.MethodDeclaration) {
    this.verifyParameters(node, [
      { name: 'nextProps', type: this.propsTypeName },
      { name: 'nextState', type: this.stateTypeName },
    ])
  }

  private verifyComponentDidUpdate(node: ts.MethodDeclaration) {
    this.verifyParameters(node, [
      { name: 'prevProps', type: this.propsTypeName },
      { name: 'prevState', type: this.stateTypeName },
    ])
  }

  private verifyShouldComponentUpdate(node: ts.MethodDeclaration) {
    this.verifyParameters(node, [
      { name: 'nextProps', type: this.propsTypeName },
      { name: 'nextState', type: this.stateTypeName },
    ])
  }
}
