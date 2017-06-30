/*
 *  This file is part of SYZOJ.
 *
 *  Copyright (c) 2016 Menci <huanghaorui301@gmail.com>
 *
 *  SYZOJ is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 *
 *  SYZOJ is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU Affero General Public License for more details.
 *
 *  You should have received a copy of the GNU Affero General Public
 *  License along with SYZOJ. If not, see <http://www.gnu.org/licenses/>.
 */

'use strict';

let Sequelize = require('sequelize');
let db = syzoj.db;

let model = db.define('file', {
  id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
  type: { type: Sequelize.STRING(80) },
  md5: { type: Sequelize.STRING(80), unique: true }
}, {
  timestamps: false,
  tableName: 'file',
  indexes: [
    {
      fields: ['type'],
    },
    {
      fields: ['md5'],
    }
  ]
});

let Model = require('./common');
class File extends Model {
  static create(val) {
    return File.fromRecord(File.model.build(Object.assign({
      type: '',
      md5: ''
    }, val)));
  }

  getPath() {
    return File.resolvePath(this.type, this.md5);
  }

  static resolvePath(type, md5) {
    return syzoj.utils.resolvePath(syzoj.config.upload_dir, type, md5);
  }

  static async upload(path, type) {
    let fs = Promise.promisifyAll(require('fs-extra'));

    let buf = await fs.readFileAsync(path);

    if (buf.length > syzoj.config.limit.data_size) throw new ErrorMessage('数据包太大。');

    try {
      let AdmZip = require('adm-zip');
      let zip = new AdmZip(buf);
      this.unzipSize = 0;
      for (let x of zip.getEntries()) this.unzipSize += x.header.size;
    } catch (e) {
      this.unzipSize = null;
    }

    let key = syzoj.utils.md5(buf);
    await fs.moveAsync(path, File.resolvePath(type, key), { overwrite: true });

    let file = await File.findOne({ where: { md5: key } });
    if (!file) {
      file = await File.create({
        type: type,
        md5: key
      });
      await file.save();
    }

    return file;
  }

  async getUnzipSize() {
    if (this.unzipSize === undefined)  {
      try {
        let fs = Promise.promisifyAll(require('fs-extra'));
        let buf = await fs.readFileAsync(this.getPath());

        let AdmZip = require('adm-zip');
        let zip = new AdmZip(buf);

        this.unzipSize = 0;
        for (let x of zip.getEntries()) this.unzipSize += x.header.size;
      } catch (e) {
        this.unzipSize = null;
      }
    }

    if (this.unzipSize === null) throw new ErrorMessage('无效的 ZIP 文件。');
    else return this.unzipSize;
  }

  getModel() { return model; }
}

File.model = model;

module.exports = File;