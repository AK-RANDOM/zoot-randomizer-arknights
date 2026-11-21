// Compatibility entry point; the shared artwork command owns downloads and validation.
if (!process.argv.includes('--kind')) process.argv.push('--kind', 'portrait')
await import('./download-artwork.mts')
