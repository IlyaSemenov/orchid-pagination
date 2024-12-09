import { defineConfig } from "@ilyasemenov/eslint-config"

export default defineConfig().append({
  files: ["**/*.tst.ts"],
  rules: {
    "unused-imports/no-unused-vars": "off",
  },
})
