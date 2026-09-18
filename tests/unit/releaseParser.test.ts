import { describe, it, expect } from 'vitest';
import { ReleaseParser } from '../../src/parser/releaseParser.js';

describe('ReleaseParser', () => {
  it('parses 4K HDR Atmos Remux movie release correctly', () => {
    const raw = 'Dune.Part.Two.2024.2160p.UHD.Remux.DV.HDR10+.TrueHD.Atmos.7.1.x265-FLUX.mkv';
    const parsed = ReleaseParser.parse(raw);

    expect(parsed.title.toLowerCase()).toContain('dune part two');
    expect(parsed.year).toBe(2024);
    expect(parsed.resolution).toBe('2160p');
    expect(parsed.source).toBe('REMUX');
    expect(parsed.codec).toBe('HEVC');
    expect(parsed.hdr.dolbyVision).toBe(true);
    expect(parsed.hdr.hdr10plus).toBe(true);
    expect(parsed.hdr.hdr).toBe(true);
    expect(parsed.audio.codec).toBe('Atmos');
    expect(parsed.audio.channels).toBe('7.1');
    expect(parsed.releaseGroup).toBe('FLUX');
    expect(parsed.container).toBe('mkv');
  });

  it('parses 1080p BluRay DTS-HD MA movie release', () => {
    const raw = 'Fight.Club.1999.1080p.BluRay.x264.DTS-HD.MA.5.1-FGT.mkv';
    const parsed = ReleaseParser.parse(raw);

    expect(parsed.title.toLowerCase()).toContain('fight club');
    expect(parsed.year).toBe(1999);
    expect(parsed.resolution).toBe('1080p');
    expect(parsed.source).toBe('BluRay');
    expect(parsed.codec).toBe('AVC');
    expect(parsed.audio.codec).toBe('DTS-HD MA');
    expect(parsed.audio.channels).toBe('5.1');
    expect(parsed.hdr.hdr).toBe(false);
    expect(parsed.releaseGroup).toBe('FGT');
  });

  it('parses WEB-DL TV series episode release', () => {
    const raw = 'Breaking.Bad.S05E14.Ozymandias.1080p.WEB-DL.DDP5.1.H.264-NTb.mkv';
    const parsed = ReleaseParser.parse(raw);

    expect(parsed.title.toLowerCase()).toContain('breaking bad');
    expect(parsed.season).toBe(5);
    expect(parsed.episode).toBe(14);
    expect(parsed.isCompleteSeason).toBe(false);
    expect(parsed.resolution).toBe('1080p');
    expect(parsed.source).toBe('WEB-DL');
    expect(parsed.codec).toBe('AVC');
    expect(parsed.audio.codec).toBe('EAC3');
    expect(parsed.audio.channels).toBe('5.1');
    expect(parsed.releaseGroup).toBe('NTb');
  });

  it('parses multi-episode release', () => {
    const raw = 'Stranger.Things.S04E01-E04.2160p.NF.WEB-DL.DDP5.1.Atmos.DV.x265-WDYM.mkv';
    const parsed = ReleaseParser.parse(raw);

    expect(parsed.season).toBe(4);
    expect(parsed.episode).toBe(1);
    expect(parsed.episodes).toEqual([1, 2, 3, 4]);
    expect(parsed.hdr.dolbyVision).toBe(true);
    expect(parsed.audio.codec).toBe('Atmos');
  });

  it('parses complete season pack', () => {
    const raw = 'Severance.S01.COMPLETE.2160p.ATVP.WEB-DL.DDP5.1.Atmos.DV.HEVC-FLUX';
    const parsed = ReleaseParser.parse(raw);

    expect(parsed.season).toBe(1);
    expect(parsed.isCompleteSeason).toBe(true);
    expect(parsed.resolution).toBe('2160p');
  });

  it('parses AV1 and 10bit releases', () => {
    const raw = 'Fallout.S01E01.1080p.10bit.AV1.Opus.5.1-ANON.mp4';
    const parsed = ReleaseParser.parse(raw);

    expect(parsed.resolution).toBe('1080p');
    expect(parsed.codec).toBe('AV1');
    expect(parsed.bitDepth).toBe(10);
    expect(parsed.container).toBe('mp4');
  });

  it('parses bracketed anime release correctly', () => {
    const raw = '[SubsPlease] Sousou no Frieren - 28 (1080p) [9812A4F1].mkv';
    const parsed = ReleaseParser.parse(raw);

    expect(parsed.episode).toBe(28);
    expect(parsed.resolution).toBe('1080p');
    expect(parsed.releaseGroup).toBe('SubsPlease');
  });

  it('handles CAM and low quality releases', () => {
    const raw = 'Avatar.The.Way.of.Water.2022.HDCAM.x264-WHISKEY';
    const parsed = ReleaseParser.parse(raw);

    expect(parsed.source).toBe('CAM');
    expect(parsed.resolution).toBe('unknown');
  });

  it('parses alternative 1x02 episode notation', () => {
    const raw = 'The.Sopranos.1x05.College.720p.HDTV.AC3-GROUP.avi';
    const parsed = ReleaseParser.parse(raw);

    expect(parsed.season).toBe(1);
    expect(parsed.episode).toBe(5);
    expect(parsed.resolution).toBe('720p');
    expect(parsed.source).toBe('HDTV');
    expect(parsed.audio.codec).toBe('AC3');
    expect(parsed.container).toBe('avi');
  });

  it('parses 4K SDR releases correctly without HDR flags', () => {
    const raw = 'Oppenheimer.2023.2160p.SDR.WEB-DL.DDP5.1.HEVC-KOGI';
    const parsed = ReleaseParser.parse(raw);

    expect(parsed.resolution).toBe('2160p');
    expect(parsed.hdr.hdr).toBe(false);
    expect(parsed.hdr.dolbyVision).toBe(false);
    expect(parsed.codec).toBe('HEVC');
  });
});
