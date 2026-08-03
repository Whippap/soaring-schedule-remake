const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo config plugin that replaces the library-generated widget provider Java
 * stubs with full implementations containing AlarmManager-based hourly updates.
 *
 * The react-native-android-widget plugin generates simple stubs (just extends
 * RNWidgetProvider). This plugin overwrites them with our custom implementation.
 */
function withWidgetConfig(config) {
  return withDangerousMod(config, [
    'android',
    (dangerousConfig) => {
      const pkg = config.android?.package;
      if (!pkg) {
        console.warn('withWidgetConfig: no android.package found, skipping');
        return dangerousConfig;
      }

      const javaSrc = path.join(
        dangerousConfig.modRequest.platformProjectRoot,
        'android/app/src/main/java',
        pkg.split('.').join('/'),
        'widget',
      );

      const templatePath = path.join(__dirname, 'templates', 'WidgetProvider.java');
      if (!fs.existsSync(templatePath)) {
        console.warn('withWidgetConfig: template not found at', templatePath);
        return dangerousConfig;
      }

      const template = fs.readFileSync(templatePath, 'utf-8');

      // Widget classes that need AlarmManager support
      const widgetNames = ['CourseWidget', 'SmallCourseWidget'];

      for (const name of widgetNames) {
        const javaFile = path.join(javaSrc, `${name}.java`);
        // Only overwrite if the library generated the stub
        if (!fs.existsSync(javaFile)) {
          console.warn(`withWidgetConfig: ${javaFile} not found, skipping`);
          continue;
        }

        const content = template
          .replace(/\{\{PACKAGE\}\}/g, pkg)
          .replace(/\{\{CLASS_NAME\}\}/g, name);

        fs.writeFileSync(javaFile, content);
        console.log(`withWidgetConfig: updated ${name}.java`);
      }

      return dangerousConfig;
    },
  ]);
}

module.exports = withWidgetConfig;
