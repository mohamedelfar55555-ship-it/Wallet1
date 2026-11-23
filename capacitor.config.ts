interface CapacitorConfigLite {
  appId: string;
  appName: string;
  webDir: string;
  server?: {
    androidScheme?: string;
  };
  android?: {
    allowMixedContent?: boolean;
  };
}

// Independent educational demo wallet simulator package ID (does not impersonate Vodafone)
const config: CapacitorConfigLite = {
  appId: 'com.demo.wallet.simulator',
  appName: 'Demo Cash Wallet',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
