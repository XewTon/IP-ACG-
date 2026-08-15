declare module 'vanta/dist/vanta.fog.min' {
  interface VantaOptions {
    [k: string]: unknown
  }
  interface VantaEffect {
    destroy: () => void
  }
  const Vanta: (opts: VantaOptions) => VantaEffect
  export default Vanta
}
