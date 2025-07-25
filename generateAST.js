const Parser = require('tree-sitter');
const C = require('tree-sitter-c');
const CPP = require('tree-sitter-cpp');

/**
 * Generate AST object for ECharts from code and language
 */
function generateAST(code, language) {
  return new Promise((resolve, reject) => {
    try {
      const parser = new Parser();

      if (language === 'c') {
        parser.setLanguage(C);
      } else if (language === 'cpp' || language === 'c++') {
        parser.setLanguage(CPP);
      } else {
        return reject(new Error('Unsupported language for AST'));
      }

      const tree = parser.parse(code);

      // Convert Tree-Sitter node tree to ECharts-compatible JSON
      function convertNode(node, source) {
        const result = {
          name: node.type,
          value: source.slice(node.startIndex, node.endIndex)
        };

        if (node.childCount > 0) {
          result.children = [];
          for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i);
            if (child) result.children.push(convertNode(child, source));
          }
        }

        return result;
      }

      const astJson = convertNode(tree.rootNode, code);
      resolve(astJson);
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = generateAST;

// Optional CLI usage
if (require.main === module) {
  const fs = require('fs');
  const [,, lang, file] = process.argv;
  if (!lang || !file) {
    console.log('Usage: node generateAST.js <c|cpp> <code-file>');
    process.exit(1);
  }

  const code = fs.readFileSync(file, 'utf-8');
  generateAST(code, lang)
    .then(ast => console.log(JSON.stringify(ast, null, 2)))
    .catch(err => console.error('Error generating AST:', err));
}
