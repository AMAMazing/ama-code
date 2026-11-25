/// <reference types="vite/client" />

declare module "virtual:ambient-core" {
	interface AmbientCoreAssets {
		styleCss: string
		mediaCss: string
		phoneticsJs: string
		tutorialJs: string
		emojisJs: string
		syncJs: string
		thaiCoachJs: string
		trancyParserJs: string
		mediaEngineJs: string
		appJs: string
	}

	const assets: AmbientCoreAssets
	export default assets
}