import os, glob, re

paths = glob.glob('src/app/(dashboard)/**/*.tsx', recursive=True)
for path in paths:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replace literal dollars in template literals: `$$` -> `₹$`
    # Actually, let's just replace `$${` with `₹${`
    content = content.replace('`$$', '`₹$')
    content = content.replace('", `$$', '", `₹$')
    
    # Replace literal dollars in JSX: 
    # Look for >$ or > $ or \n  $ etc followed by {
    # We can match $ followed by { but ONLY if not preceded by backtick or part of a template literal.
    # Actually, it's safer to just replace `\$\{` with `₹{` ONLY if preceded by `>\s*` or `^\s*`.
    content = re.sub(r'([>]\s*)\$\{', r'\1₹{', content)
    content = re.sub(r'(^\s*)\$\{', r'\1₹{', content, flags=re.MULTILINE)
    
    # Also look for `Grand Total: \$\{`
    content = re.sub(r'Grand Total:\s*\$\{', r'Grand Total: ₹{', content)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
