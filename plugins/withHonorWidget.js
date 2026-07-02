const { withAndroidManifest } = require('@expo/config-plugins');

function withHonorWidget(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    if (!application) return config;

    const receivers = application.receiver ?? [];
    for (const receiver of receivers) {
      if (receiver.$?.['android:name']?.includes('Widget') || receiver.$?.['android:name']?.includes('widget')) {
        receiver.$['android:exported'] = 'true';
      }
    }

    return config;
  });
}

module.exports = withHonorWidget;
