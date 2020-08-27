import * as path from 'path'
import * as fs from 'fs'

import * as webpack from 'webpack'
import CopyPlugin from 'copy-webpack-plugin'

const CHROMIUM_BASED_BROWSER = /chrome|edge/

export function makeWebpackConfig(rootDir: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prettyJSON = (obj: any) => JSON.stringify(obj, null, 2)

  const API = process.env.API || 'chrome'
  const BROWSER = process.env.BROWSER || 'chrome'
  const LIVE_RELOAD = Boolean(process.env.LIVE_RELOAD)

  // Can cut build times down from 30s to 10s on some machines
  const TS_LOADER_TRANSPILE_ONLY = Boolean(process.env.TS_LOADER_TRANSPILE_ONLY)

  // This is extended from the root IDE config
  const TEST_TSCONFIG = path.join(rootDir, '/test/tsconfig.json')
  const TSCONFIG_DEBUG_JSON = path.join(rootDir, 'tsconfig.debug.json')
  const TSCONFIG_BUILD_JSON = path.join(rootDir, 'tsconfig.build.json')

  // eslint-disable-next-line no-nested-ternary
  const TSCONFIG = TS_LOADER_TRANSPILE_ONLY
    ? TEST_TSCONFIG
    : process.env.TSCONFIG_DEBUG
    ? TSCONFIG_DEBUG_JSON
    : TSCONFIG_BUILD_JSON

  // Possible to override name/version so can publish as different extension
  const WEXT_MANIFEST_SUFFIX = process.env.WEXT_MANIFEST_SUFFIX
  const WEXT_MANIFEST_VERSION = process.env.WEXT_MANIFEST_VERSION
  const WEXT_MANIFEST_BROWSER_SPECIFIC_SETTINGS_GECKO_ID =
    process.env.WEXT_MANIFEST_BROWSER_SPECIFIC_SETTINGS_GECKO_ID

  const copyToDist = [
    {
      from: 'manifest.json',
      to: 'manifest.json',
      transform: (content: Buffer) => {
        const manifest = JSON.parse(content.toString())
        if (WEXT_MANIFEST_SUFFIX) {
          manifest.name += WEXT_MANIFEST_SUFFIX
        }
        if (WEXT_MANIFEST_VERSION) {
          manifest.version = WEXT_MANIFEST_VERSION
        }
        if (BROWSER === 'firefox') {
          if (WEXT_MANIFEST_BROWSER_SPECIFIC_SETTINGS_GECKO_ID) {
            manifest.browser_specific_settings.gecko.id = WEXT_MANIFEST_BROWSER_SPECIFIC_SETTINGS_GECKO_ID
          }
        } else {
          delete manifest['browser_specific_settings']
        }
        return prettyJSON(manifest)
      }
    },
    {
      from: 'static',
      to: 'static',
      transform: (content: Buffer, path: string) => {
        if (
          LIVE_RELOAD &&
          BROWSER.match(CHROMIUM_BASED_BROWSER) &&
          path.endsWith('background.html')
        ) {
          return content
            .toString()
            .replace(
              '<!--INSERT_HOT_RELOAD-->',
              '<script src="../hot-reload.js"></script>'
            )
        } else if (
          BROWSER.match(CHROMIUM_BASED_BROWSER) &&
          path.endsWith('popup.html')
        ) {
          return content
            .toString()
            .replace(
              '<!--INSERT_FORCE_REDRAW_SCRIPT-->',
              '<script src="./forceRedraws.js"></script>'
            )
        } else {
          return content
        }
      }
    },
    { from: 'res', to: 'res' }
  ]

  if (LIVE_RELOAD) {
    copyToDist.push({
      from: require.resolve('crx-hotreload'),
      to: 'hot-reload.js'
    })
  }

  const entry: Record<string, string> = {
    content: './src/content/content.ts',
    moneystream: './src/moneystream.ts',
    popup: './src/popup/popup.tsx',
    options: './src/options/options.tsx',
    background: './src/background/background.ts'
  }

  Object.keys(entry).forEach(k => {
    const entryPath = path.join(rootDir, entry[k])
    if (!fs.existsSync(entryPath)) {
      delete entry[k]
    }
  })

  const config: webpack.Configuration = {
    mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
      symlinks: true,
      // Only add these if using the TEST_TSCONFIG which transpile only implies
      alias: {
        ...(TS_LOADER_TRANSPILE_ONLY
          ? require('../../../webpack.tsconfig.aliases')
          : {})
      }
    },

    devtool: 'inline-source-map',

    entry: entry,

    stats: {
      warningsFilter: TS_LOADER_TRANSPILE_ONLY
        ? [/export .* was not found in(.|\n)*\.ts$/]
        : []
    },

    plugins: [
      new webpack.DefinePlugin({
        WEBPACK_DEFINE_API: API,
        WEBPACK_DEFINE_BROWSER: JSON.stringify(BROWSER)
      }),
      new CopyPlugin({ patterns: copyToDist })
    ],

    output: {
      filename: '[name].js',
      path: path.join(rootDir, 'dist'),
      libraryTarget: 'umd'
    },

    optimization: {
      minimize: false
    },

    module: {
      // noParse: [ /\bws$/ ],
      rules: [
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          use: [
            {
              // We must use require.resolve in the mono repo with
              // deduplicated dependencies
              loader: require.resolve('ts-loader'),
              // Do not check types in watch mode
              options: TS_LOADER_TRANSPILE_ONLY
                ? {
                    configFile: TSCONFIG,
                    projectReferences: false,
                    transpileOnly: true,
                    compilerOptions: process.env.TSCONFIG_DEBUG
                      ? require(TSCONFIG_DEBUG_JSON).compilerOptions
                      : {}
                  }
                : {
                    configFile: TSCONFIG,
                    projectReferences: true
                  }
            }
          ]
        }
      ]
    },

    node: {
      console: true,
      fs: 'empty',
      net: 'empty',
      tls: 'empty'
    }
  }

  return config
}
