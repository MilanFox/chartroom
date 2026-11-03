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
        {
          rel: 'icon',
          type: 'image/x-icon',
          href: '/favicon.ico',
        },
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
    '@constants': resolve(__dirname, './shared/constants'),
    '@server': resolve(__dirname, './server'),
    '@layouts': resolve(__dirname, './app/layouts'),
    '@middleware': resolve(__dirname, './app/middleware'),
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
    serverAssets: [{ baseName: 'migrations', dir: './db/migrations' }],
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
