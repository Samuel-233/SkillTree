export function getPath(fileName: string): string {
  let baseUrl = import.meta.env.BASE_URL;
  // 确保 baseUrl 以 / 结尾 (如果不是根路径 '/')
  if (baseUrl !== '/' && !baseUrl.endsWith('/')) {
    baseUrl += '/';
  }
  return `${baseUrl}${fileName}`;
}