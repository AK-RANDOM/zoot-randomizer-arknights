export interface AppDialogCopy {
  title: string
  message: string
}

export function resolveAppDialogCopy(copy: AppDialogCopy | string): AppDialogCopy {
  if (typeof copy !== 'string') return copy
  const [title, ...lines] = copy.split('\n')
  return { title: title.trim(), message: lines.join('\n').trim() }
}
