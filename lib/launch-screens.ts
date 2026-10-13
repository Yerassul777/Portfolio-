// iOS shows these while an installed web app starts (it ignores the manifest
// for this). One image per screen size: [css width, css height, dpr] in
// portrait; iPads also get a landscape image, since they are often held
// sideways. A device without its own image starts on a white screen, so the
// list includes old ones too (iPhone SE 1, 12/13 mini, 9.7" and 10.5" iPads). The images in public/splash are rendered from the same list;
// regenerate them when this list changes.
export const LAUNCH_DEVICES: [number, number, number][] = [
  [320, 568, 2], [375, 667, 2], [414, 736, 3], [360, 780, 3], [375, 812, 3], [414, 896, 2], [414, 896, 3], [390, 844, 3], [428, 926, 3],
  [393, 852, 3], [430, 932, 3], [402, 874, 3], [440, 956, 3],
  [744, 1133, 2], [768, 1024, 2], [810, 1080, 2], [834, 1112, 2], [820, 1180, 2], [834, 1194, 2], [834, 1210, 2], [1024, 1366, 2], [1032, 1376, 2],
]

const isTablet = (w: number) => w >= 700

export const LAUNCH_SCREENS = LAUNCH_DEVICES.flatMap(([w, h, dpr]) => {
  const media = (orientation: string) =>
    `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: ${orientation})`
  const portrait = { url: `/splash/launch-${w * dpr}x${h * dpr}.png`, media: media("portrait") }
  if (!isTablet(w)) return [portrait]
  return [portrait, { url: `/splash/launch-${h * dpr}x${w * dpr}.png`, media: media("landscape") }]
})
