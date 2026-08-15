export function fileMetadata(fileName) {
  const extension = fileName.match(/\.([^.]+)$/)?.[1]?.toLowerCase();
  const sourceStem = extension ? fileName.slice(0, -(extension.length + 1)) : fileName;
  const sourceExtension = extension === 'md' || extension === 'markdown' ? 'md' : 'txt';

  return {
    sourceStem,
    sourceExtension,
    outputName: `${sourceStem}.cleaned.${sourceExtension}`,
  };
}
