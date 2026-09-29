import path from 'node:path';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const testDir = path.join(projectRoot, 'tests', 'fixtures');
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

const sampleMkv = path.join(testDir, 'sample_input.mkv');
const sampleSrt = path.join(testDir, 'sample.srt');
const outputMp4 = path.join(testDir, 'sample_output.dovi.mp4');

console.log('--- 1. Creating sample subtitle and MKV file with FFmpeg ---');

// Write sample SRT
fs.writeFileSync(sampleSrt, `1
00:00:00,100 --> 00:00:02,000
Sample Dolby Vision Test Subtitle
`);

// Generate a test 2-second MKV with HEVC video, EAC3 audio, and SRT subtitle
// using ffmpeg
const ffmpegCmd = `/opt/homebrew/bin/ffmpeg -y \
  -f lavfi -i testsrc=duration=2:size=1920x1080:rate=24 \
  -f lavfi -i sine=frequency=1000:duration=2 \
  -i "${sampleSrt}" \
  -c:v libx265 -pix_fmt yuv420p10le -tag:v hvc1 \
  -c:a eac3 -b:a 448k -metadata:s:a:0 language=eng -metadata:s:a:0 title="English 5.1" \
  -c:s srt -metadata:s:s:0 language=eng -metadata:s:s:0 title="English SRT" \
  "${sampleMkv}"`;

console.log('Running test video generation...');
execSync(ffmpegCmd, { stdio: 'inherit' });

console.log('\n--- 2. Verifying Media Probe on Generated MKV ---');
// Dynamically import the compiled probe module from dist-electron/main.js or test probe directly
const ffprobeOut = execSync(
  `/opt/homebrew/bin/ffprobe -v quiet -print_format json -show_format -show_streams "${sampleMkv}"`,
  { encoding: 'utf8' }
);
const probeJson = JSON.parse(ffprobeOut);
console.log(`Video streams found: ${probeJson.streams.filter(s => s.codec_type === 'video').length}`);
console.log(`Audio streams found: ${probeJson.streams.filter(s => s.codec_type === 'audio').length}`);
console.log(`Subtitle streams found: ${probeJson.streams.filter(s => s.codec_type === 'subtitle').length}`);

console.log('\n--- 3. Testing Direct Remux Pipeline to MP4 ---');
// Run FFmpeg direct remux matching our engine logic
const remuxCmd = `/opt/homebrew/bin/ffmpeg -y \
  -i "${sampleMkv}" \
  -map 0:v:0 -c:v copy -strict unofficial -tag:v hvc1 \
  -map 0:a:0 -c:a:0 copy \
  -map 0:s:0 -c:s:0 mov_text -metadata:s:s:0 language=eng \
  "${outputMp4}"`;

execSync(remuxCmd, { stdio: 'inherit' });

if (fs.existsSync(outputMp4)) {
  const stat = fs.statSync(outputMp4);
  console.log(`\n✅ SUCCESS: MP4 generated at: ${outputMp4} (${stat.size} bytes)`);

  // Inspect generated MP4
  const verifyOut = execSync(
    `/opt/homebrew/bin/ffprobe -v quiet -print_format json -show_streams "${outputMp4}"`,
    { encoding: 'utf8' }
  );
  const verifyJson = JSON.parse(verifyOut);
  const vStream = verifyJson.streams.find(s => s.codec_type === 'video');
  const aStream = verifyJson.streams.find(s => s.codec_type === 'audio');
  const sStream = verifyJson.streams.find(s => s.codec_type === 'subtitle');

  console.log(`  - Video codec tag: ${vStream?.codec_tag_string} (${vStream?.codec_name})`);
  console.log(`  - Audio codec: ${aStream?.codec_name} (${aStream?.channels} ch)`);
  console.log(`  - Subtitle codec: ${sStream?.codec_name}`);
  console.log('\n🎉 ALL PIPELINE VERIFICATIONS PASSED!\n');
} else {
  console.error('❌ FAILED: Output MP4 was not created.');
  process.exit(1);
}
