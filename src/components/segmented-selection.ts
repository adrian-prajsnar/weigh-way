/** Only the latest failed change may roll back an optimistic selection. */
export function shouldRevertSelection(
  success: boolean | void,
  changeId: number,
  latestChangeId: number,
): boolean {
  return success === false && changeId === latestChangeId;
}
