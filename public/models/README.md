# MEET MEET Fair Play Audio Model

Place the official MediaPipe/YAMNet TFLite audio classification model here:

```text
public/models/yamnet.tflite
```

Default runtime path:

```text
/models/yamnet.tflite
```

The path can be overridden for local testing with:

```text
VITE_FAIR_PLAY_AUDIO_MODEL_PATH=/models/yamnet.tflite
```

Use the official YAMNet TFLite model source referenced in
`docs/MEET_MEET_STEP6GR2_REPORT.md`. Do not commit microphone recordings,
waveforms, spectrograms, or third-party audio models here.
