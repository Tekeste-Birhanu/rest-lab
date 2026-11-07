export const STARTER_API_JS =
  "const response = await fetch('/api/snippets');\nconsole.log(await response.json());"

export const STARTER_SNIPPETS = [
  {
    title: 'Format a date',
    language: 'JavaScript',
    description: 'Format the current date for display with the built-in internationalization API.',
    code: 'const formatted = new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(new Date());',
  },
  {
    title: 'Count words',
    language: 'Python',
    description: 'Count the words in a string using whitespace separation.',
    code: 'def count_words(text):\n    return len(text.split())',
  },
  {
    title: 'Greeting query',
    language: 'SQL',
    description: 'Return a text value with a SQL query.',
    code: "SELECT 'Hello, world!' AS greeting;",
  },
] as const
