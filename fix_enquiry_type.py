import re

with open("src/app/(dashboard)/enquiries/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("  createdAt: string;\n};", "  createdAt: string;\n  updatedAt?: string;\n};")

with open("src/app/(dashboard)/enquiries/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)
