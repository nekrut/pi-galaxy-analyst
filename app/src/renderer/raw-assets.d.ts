// Vite text imports (`import s from "./x.md?raw"`). The app tsconfig sets no
// `types`, so declare the module shape here for tsc.
declare module "*?raw" {
  const content: string;
  export default content;
}
