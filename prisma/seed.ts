import { prisma } from '../src/lib/prisma';

async function main() {
  console.log('Seeding Lost Reasons...');
  const defaultLostReasons = [
    'Price Too High',
    'Competitor Chosen',
    'Project Postponed',
    'Budget Cancelled',
    'No Response',
  ];

  for (const name of defaultLostReasons) {
    const existing = await prisma.lostReason.findUnique({ where: { name } });
    if (!existing) {
      await prisma.lostReason.create({
        data: { name, isActive: true },
      });
      console.log(`Created lost reason: ${name}`);
    }
  }

  console.log('Seeding Standard Furniture Categories...');
  const defaultCategories = [
    { name: 'Modular Kitchen', code: 'MK' },
    { name: 'Wardrobe & Storage', code: 'WR' },
    { name: 'Commercial Workstations', code: 'CW' },
    { name: 'Executive Office Furniture', code: 'OF' },
    { name: 'Living & Dining', code: 'LD' },
    { name: 'Custom Millwork & Paneling', code: 'CM' },
    { name: 'Vanity & Bathroom Units', code: 'VS' },
    { name: 'Loose Furniture & Seating', code: 'LF' },
  ];

  for (const cat of defaultCategories) {
    const existing = await prisma.category.findUnique({ where: { name: cat.name } });
    if (!existing) {
      await prisma.category.create({
        data: { name: cat.name, code: cat.code },
      });
      console.log(`Created category: ${cat.name} (${cat.code})`);
    }
  }

  console.log('Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('Error seeding data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
