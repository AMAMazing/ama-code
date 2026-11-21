/// <reference types="vite/client" />

declare module "virtual:ambient-core" {
	interface AmbientCoreAssets {
		styleCss: string
		phoneticsJs: string
		tutorialJs: string
		emojisJs: string
		syncJs: string
		appJs: string
	}

	const assets: AmbientCoreAssets
	export default assets
}