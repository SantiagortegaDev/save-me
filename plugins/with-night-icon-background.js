// Gives the Android adaptive icon a dark background when the phone is in dark mode
// (values-night/colors.xml overrides the iconBackground color that expo prebuild writes).
const { AndroidConfig, withAndroidColorsNight } = require('expo/config-plugins');

module.exports = function withNightIconBackground(config, { color = '#161616' } = {}) {
  return withAndroidColorsNight(config, (cfg) => {
    cfg.modResults = AndroidConfig.Colors.assignColorValue(cfg.modResults, { name: 'iconBackground', value: color });
    return cfg;
  });
};
