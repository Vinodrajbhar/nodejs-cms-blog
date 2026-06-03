import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../../models/User.js';
import Setting from '../../models/Setting.js';
import Theme from '../../models/Theme.js';

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Create admin user
    const existingAdmin = await User.findOne({ email: 'admin@blog.com' });
    if (!existingAdmin) {
      await User.create({
        username: 'admin',
        email: 'admin@blog.com',
        password: 'admin123',
        role: 'admin',
      });
      console.log('✓ Admin user created (admin@blog.com / admin123)');
    } else {
      console.log('• Admin user already exists');
    }

    // Create default settings
    const defaults = {
      siteName: 'My Blog',
      postsPerPage: '6',
      activeTheme: 'default',
      permalinkStructure: '/post/%postname%/',
      categoryBase: 'category',
      tagBase: 'tag',
      permalinkTrailingSlash: 'true',
    };

    for (const [key, value] of Object.entries(defaults)) {
      await Setting.setSetting(key, value);
    }
    console.log('✓ Default settings created');

    // Create default theme record
    const existingDefault = await Theme.findOne({ slug: 'default' });
    if (!existingDefault) {
      await Theme.create({
        name: 'Default',
        slug: 'default',
        description: 'The built-in default theme.',
        author: 'Blog CMS',
        version: '1.0.0',
        isActive: false,
      });
      console.log('✓ Default theme record created');
    } else {
      console.log('• Default theme already exists');
    }

    console.log('\nSeed completed successfully!');
    console.log('Login with: admin@blog.com / admin123');
  } catch (error) {
    console.error('Seed error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seed();
