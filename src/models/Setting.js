import mongoose from 'mongoose';

const settingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  { timestamps: true }
);

const Setting = mongoose.model('Setting', settingSchema);

// Helper to get all settings as a plain object
Setting.getSettings = async function () {
  const docs = await this.find({});
  const settings = {};
  docs.forEach((doc) => {
    settings[doc.key] = doc.value;
  });
  return settings;
};

// Helper to get a single setting
Setting.getSetting = async function (key, defaultValue = null) {
  const doc = await this.findOne({ key });
  return doc ? doc.value : defaultValue;
};

// Helper to set a single setting
Setting.setSetting = async function (key, value) {
  await this.findOneAndUpdate({ key }, { value }, { upsert: true, returnDocument: 'after' });
};

export default Setting;
