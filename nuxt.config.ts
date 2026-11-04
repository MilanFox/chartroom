// https://nuxt.com/docs/api/configuration/nuxt-config
import { resolve } from 'path';
import { version } from './package.json';

export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@pinia/nuxt',
    '@vueuse/nuxt',
  ],

  components: [{ path: './components', pathPrefix: false }],

  devtools: { enabled: true },

  app: {
    head: {
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
      ],
    },
  },

  css: ['@assets/scss/main.scss'],

  runtimeConfig: {
    version,
  },

  alias: {
    '@assets': resolve(__dirname, './app/assets'),
    '@components': resolve(__dirname, './app/components'),
    '@atoms': resolve(__dirname, './app/components/atoms'),
    '@molecules': resolve(__dirname, './app/components/molecules'),
    '@organisms': resolve(__dirname, './app/components/organisms'),
    '@stores': resolve(__dirname, './app/stores'),
    '@composables': resolve(__dirname, './app/composables'),
    '@layouts': resolve(__dirname, './app/layouts'),
    '@middleware': resolve(__dirname, './app/middleware'),
  },

  routeRules: {
    '/api/docs': { ssr: false },
  },

  sourcemap: {
    server: false,
    client: true,
  },

  experimental: {
    serverAppConfig: false,
  },

  compatibilityDate: '2025-11-01',

  nitro: {
    serverAssets: [{ baseName: 'migrations', dir: './db/migrations' }, { baseName: 'adapter', dir: './adapter' }],
  },

  vite: {
    build: {
      cssCodeSplit: false,
    },
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: '@use "@assets/scss/global.scss" as *;',
        },
      },
    },
  },

  postcss: {
    plugins: {
      'postcss-pxtorem': {
        rootValue: 16,
        unitPrecision: 3,
        propList: ['*', '!border*'],
        replace: true,
        mediaQuery: true,
        minPixelValue: 2,
      },
    },
  },

  eslint: {
    config: {
      stylistic: true,
    },
  },
});
