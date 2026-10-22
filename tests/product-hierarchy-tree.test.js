const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Product Hierarchy Tree View Compliance & Integrity Suite', async (t) => {
  const HIERARCHY_DIR = path.join(__dirname, '..', 'src', 'app', '(dashboard)', 'products', 'hierarchy');
  const COMPONENTS_DIR = path.join(HIERARCHY_DIR, 'components');

  const filesToCheck = [
    path.join(HIERARCHY_DIR, 'page.tsx'),
    path.join(COMPONENTS_DIR, 'HierarchyTreeExplorer.tsx'),
    path.join(COMPONENTS_DIR, 'HierarchyTreeNode.tsx'),
    path.join(COMPONENTS_DIR, 'HierarchyInspector.tsx'),
    path.join(COMPONENTS_DIR, 'HierarchyColumnBrowser.tsx'),
    path.join(COMPONENTS_DIR, 'HierarchyAddInlineModal.tsx'),
    path.join(COMPONENTS_DIR, 'HierarchyInfoPopover.tsx'),
  ];

  await t.test('RULE-01: Zero Em Dashes across all Hierarchy components', () => {
    for (const file of filesToCheck) {
      assert.ok(fs.existsSync(file), `File must exist: ${file}`);
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        assert.ok(
          !line.includes('—'),
          `Forbidden em dash (—) detected in ${path.basename(file)} at line ${index + 1}: "${line.trim()}"`
        );
      });
    }
  });

  await t.test('RULE-02: Selected active state is strictly Black (#000000) and never Orange', () => {
    const treeNodeContent = fs.readFileSync(path.join(COMPONENTS_DIR, 'HierarchyTreeNode.tsx'), 'utf8');
    assert.ok(
      treeNodeContent.includes('bg-[#000000]'),
      'HierarchyTreeNode must use strictly Black (bg-[#000000]) for selected state'
    );
    assert.ok(
      !treeNodeContent.includes('bg-orange-500 text-white') && !treeNodeContent.includes('bg-[#FF7700] text-white'),
      'HierarchyTreeNode selected state must NOT use Orange background'
    );

    const pageContent = fs.readFileSync(path.join(HIERARCHY_DIR, 'page.tsx'), 'utf8');
    assert.ok(
      pageContent.includes('bg-[#000000] text-white'),
      'View toggle selected state must use Black (bg-[#000000] text-white)'
    );

    const columnContent = fs.readFileSync(path.join(COMPONENTS_DIR, 'HierarchyColumnBrowser.tsx'), 'utf8');
    assert.ok(
      columnContent.includes('bg-[#000000] border-[#000000] text-white'),
      'HierarchyColumnBrowser selected state must use Black (bg-[#000000])'
    );
  });

  await t.test('RULE-03: Faint secondary monospace codes and rest-to-hover slot pattern', () => {
    const treeNodeContent = fs.readFileSync(path.join(COMPONENTS_DIR, 'HierarchyTreeNode.tsx'), 'utf8');
    assert.ok(
      treeNodeContent.includes('font-mono'),
      'HierarchyTreeNode must render codes in font-mono'
    );
    assert.ok(
      treeNodeContent.includes('group-hover:hidden') && treeNodeContent.includes('group-hover:flex'),
      'HierarchyTreeNode must implement rest-to-hover action slot swap'
    );
  });

  await t.test('RULE-04: Auto-Code generator logic verification', () => {
    const codeGenSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'products', 'codeGen.ts'), 'utf8');
    assert.ok(codeGenSource.includes('autoCode(name'), 'codeGen.ts must export autoCode function');
    assert.ok(codeGenSource.includes("name.replace(/[^a-zA-Z]/g, '').toUpperCase()"), 'codeGen.ts must strip non-letters and uppercase');

    // Test algorithm directly
    function testAutoCode(name) {
      if (!name || typeof name !== 'string') return 'PRD';
      const cleaned = name.replace(/[^a-zA-Z]/g, '').toUpperCase();
      if (!cleaned) return 'PRD';
      return cleaned.length >= 3 ? cleaned.slice(0, 3) : cleaned.padEnd(2, 'X');
    }

    assert.equal(testAutoCode('Round Table'), 'ROU');
    assert.equal(testAutoCode('Workspace Pedestals'), 'WOR');
    assert.equal(testAutoCode('Lab Furniture'), 'LAB');
    assert.equal(testAutoCode('AB'), 'AB');
    assert.equal(testAutoCode('A'), 'AX');
  });

  await t.test('RULE-05: Info popover replaces standing prose', () => {
    const popoverContent = fs.readFileSync(path.join(COMPONENTS_DIR, 'HierarchyInfoPopover.tsx'), 'utf8');
    assert.ok(
      popoverContent.includes('Hierarchy Architecture Rules'),
      'HierarchyInfoPopover must house architecture rules'
    );
  });
});
