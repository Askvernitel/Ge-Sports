import { Buffer } from 'buffer';

// Must be its own module, imported before anything else in main.tsx. ES
// module imports are evaluated depth-first before the importing module's
// own body runs, so putting this assignment directly in main.tsx (after its
// `import App from './App.tsx'`) ran too late — App's whole tree, including
// @solana/spl-token (which references Buffer at module scope), had already
// been evaluated and crashed before this line was ever reached.
window.Buffer = Buffer;
