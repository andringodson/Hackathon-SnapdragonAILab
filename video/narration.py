"""Narration for the three-minute demo video, written to be spoken rather than read.

Every claim here is something the video shows happening, or a number with a
public source on the site. The browser build keeps up on the recording
laptop (RTF 0.3-0.8, Whisper Base alone), so the script says so, and puts
the "falls behind" argument where it belongs: two models on one CPU.

Markup, stripped from captions:
  " | "   a breath (short pause)          " || "  a deliberate, dramatic pause
  "~"     at the start of a phrase: deliver it slower and lower, for emphasis
"""

SECTIONS = [
    ("The problem", [
        "Picture an engineering lecture in India. | The lecturer says: || "
        "~Matrix A ka determinant zero hoga, | tabhi non-trivial solution milega.",
        "Half of that sentence is Hindi. | The technical terms are English. | "
        "And for millions of students, | the language of the lecture isn't their first language.",
        "Cloud captioning struggles with that mix, | charges by the minute, | "
        "and needs a connection the lecture hall often doesn't have. || "
        "~Sahaay does all of it on the laptop.",
    ]),
    ("Live, in your browser", [
        "This is the browser build, | open to anyone. | It downloads Whisper once, "
        "and then runs it on this machine, | inside the tab.",
        "I'm playing a recorded lecture into the microphone. | "
        "Captions land as the speaker pauses, | and the jargon panel explains each term as it's spoken.",
        "Now, || ~I'm cutting the network.",
        "The page is offline, | and the captions keep coming, | "
        "because nothing here ever needed the internet. | Your audio never leaves the tab.",
    ]),
    ("The desktop app", [
        "This is the desktop app, | replaying a real session it recorded. | "
        "Same interface, | same rendering code.",
        "Each caption is translated into Hindi on the device. | And look closely: || "
        "~eigenvalues stays eigenvalues. | Technical terms are protected before translation, "
        "so they still match the textbook.",
        "When the lecture ends, | Sahaay writes the notes: | topics, key points, and a glossary.",
    ]),
    ("Why it needs an NPU", [
        "Now the measurement the project is built around. | "
        "Whisper Small alone, on a laptop CPU, | runs at a real-time factor of zero point four. || "
        "Run the glossary model at the same time, | ~and it jumps to one point five five.",
        "Above one, | the captions fall further behind with every sentence. | "
        "Two models, one set of cores, | and what loses is the thing the student is reading.",
        "On Snapdragon, the Whisper encoder moves to the Hexagon NPU. | "
        "Qualcomm's own device farm measured it: || ~thirteen and a half milliseconds, | "
        "all 129 layers on the NPU, | with a job ID for every number.",
    ]),
    ("Built to be checked", [
        "It installs with one script, | degrades instead of failing, | "
        "and runs its whole test suite on x86, ARM64 and Linux, | on every push.",
        "And the site says plainly what isn't proven yet: | "
        "the full pipeline hasn't run on a physical Snapdragon laptop. | That's one command away.",
        "~On a CPU, the glossary makes the captions fall behind. || "
        "That's why Sahaay is a Snapdragon application. || Thank you.",
    ]),
]


def caption(line):
    """The line as it should read on screen."""
    return " ".join(line.replace("||", " ").replace("|", " ").replace("~", "").split())
