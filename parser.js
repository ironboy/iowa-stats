// CSV to JSON parser, optimized for data from the state of Iowa
// Thomas Frank / ironboy 2024

import fs from 'fs';
import readline from 'readline';

const settings = JSON.parse(fs.readFileSync('./settings.json', 'utf-8'));

for (let job of settings.jobs) {
  job.skip || await parse(job);
}

async function parse({
  fileToReadCsv,
  fileToWriteJson,
  fileToWriteSamplesCsv,
  fileToWriteSamplesJson,
  sampleSizePercent
}) {
  // Remember start time
  let startTime = Date.now();

  // Create write streams and delete old files (just to be sure)
  let writeStreams = [];
  for (let file of [fileToWriteJson, fileToWriteSamplesCsv, fileToWriteSamplesJson]) {
    if (!file) { continue; }
    fs.existsSync(file) && fs.unlinkSync(file);
    writeStreams.push(fs.createWriteStream(file));
  }
  writeStreams[0].write('[\n');
  writeStreams[2] && writeStreams[2].write('[\n');

  // Prepare for reading the file line by line (to big to have in memory)
  const fileStream = fs.createReadStream(fileToReadCsv);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  // Loop through each line
  console.log('\nParsing', fileToReadCsv);
  let counter = -1, keys, sampleFrequency = sampleSizePercent ? 1 / (sampleSizePercent / 100) : false;
  let errors = [], first = true, firstSample = true, partOfLine;
  for await (let line of rl) {
    counter++;
    // Assume first lines is column names
    // remove non word-characters and start with small letter
    if (!keys) {
      keys = line.split(',').map(x => x.replace(/\W/g, '').replace(/^./, x => x.toLowerCase()));
      writeStreams[1] && writeStreams[1].write(line);
    }
    // Write data after cleaning up the data types a little for the JSON
    else {
      let values = niceSplit(line), object;

      // Deal with the fact that there are linebreaks in some posts :)
      if (!partOfLine && values.length < keys.length) {
        partOfLine = values;
        continue;
      }
      if (partOfLine && values.length + partOfLine.length === keys.length + 1) {
        values[0] = partOfLine.pop() + ' ' + values[0];
        values = [...partOfLine, ...values];
        counter--;
      }
      partOfLine = false;

      // check for errors and log them
      try {
        object = Object.fromEntries(values.map((x, i) => [
          keys[i],
          (/date/i.test(keys[i]) || (fileToReadCsv.includes('County_Population_By_Year') && keys[i] === 'year'))
            ? new Date(x).toISOString().slice(0, 10) : isNaN(x) ? x : +x
        ]));
        if (values.length !== keys.length) {
          throw new Error('Keys and values not the same length. ('
            + keys.length + ' keys and ' + values.length + ' values...)');
        }
      }
      catch (error) {
        errors.push({ error: error + '', line, lineNumber: counter, partOfLine });
        continue;
      }

      // Write data
      let json = JSON.stringify([object], null, '  ').split('\n').slice(1, -1).join('\n');
      writeStreams[0].write(first ? json : ',\n' + json);
      first = false;
      if (sampleFrequency && counter % sampleFrequency === 0) {
        writeStreams[1] && writeStreams[1].write(firstSample ? line : '\n' + line);
        writeStreams[2].write(firstSample ? json : ',\n' + json);
        firstSample = false;
      }
    }
    // Report progress each 100,000 lines
    if (counter && counter % 100000 === 0) {
      console.log(niceNum(counter), 'lines parsed.');
    }
  }

  // Close streams/end writing
  writeStreams[0].write('\n]');
  writeStreams[2] && writeStreams[2].write('\n]');
  for (let stream of writeStreams) {
    stream.close();
  }

  console.log(niceNum(counter), 'lines parsed.');

  // Error report
  if (errors.length) {
    console.log('\n' + errors.length, 'errors, these lines were skipped:');
    console.log(JSON.stringify(errors, null, '  '));
  }

  console.log('\nTime taken', niceTime(Date.now() - startTime), '\n');
}

function niceSplit(x) {
  // do it fast/easy if no quotes...
  if (!x.includes('"')) { return x.split(','); }
  // first remove all qoutes with a backslash before '\"'
  x = x.replace(/\\"/g, '');
  // remove a qoute if only one
  x.split('"').length === 2 && (x = x.replace(/"/, ''));
  // now take care of splitting on ',' in general
  // but NOT splitting when ',' are within qoutes ("")
  // + removing the quotes
  let array = [''], counter = 0;
  let inQoutes = false;
  for (let char of x) {
    if (char === '"') {
      inQoutes = !inQoutes;
      continue;
    };
    if (char === ',' && !inQoutes) {
      counter++;
      array[counter] = '';
      continue;
    }
    array[counter] += char;
  }
  return array;
}

function niceNum(x) {
  return new Intl.NumberFormat('en-US').format(x);
}

function niceTime(x) {
  return new Date(x).toLocaleTimeString('sv-SE', { timeZone: 'UTC' });
}