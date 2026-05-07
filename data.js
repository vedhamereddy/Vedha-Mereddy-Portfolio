// ============================================================
//  PORTFOLIO DATA  —  edit this file to update your portfolio
// ============================================================

const PORTFOLIO = {

  // ── Personal info ─────────────────────────────────────────
  name: "Vedha",
  lastName: "Mereddy",
  location: "Atlanta, GA",
  role: "Design & Engineering",
  disciplines: ["Engineering", "Hardware Design", "Embedded Systems", "Software"],
  videoUrl: "",   // paste a YouTube/Vimeo embed URL here to show a video
  title: "Engineering Portfolio",
  tagline: "Building technology that enhances the\nhuman experience.",
  about: `I'm an engineer who cares about crafting solutions that are
    both technically sound and genuinely useful. My work spans
    hardware design, embedded systems, and software — with a focus
    on clarity, performance, and maintainability.`,

  // ── Social / contact links ────────────────────────────────
  links: [
    { label: "GitHub",   href: "https://github.com/" },
    { label: "LinkedIn", href: "https://linkedin.com/in/" },
    { label: "Email",    href: "mailto:you@example.com" },
    { label: "Resume",   href: "/resume.pdf" },
  ],

  // ── Skills / tools ────────────────────────────────────────
  skills: [
    { category: "Languages",   items: ["Python", "C/C++", "MATLAB", "Verilog", "JavaScript"] },
    { category: "Hardware",    items: ["PCB Design", "FPGA", "Embedded Systems", "Signal Processing"] },
    { category: "Software",    items: ["Git", "Linux", "Docker", "ROS", "NumPy / SciPy"] },
    { category: "Tools",       items: ["KiCad", "LTspice", "Vivado", "Altium", "SolidWorks"] },
  ],

  // ── Projects ──────────────────────────────────────────────
  // Add a new object to this array to add a project.
  // Fields: title, year, tags (array), summary, details, link (optional), image (optional path)
  projects: [
    {
      title:   "Café Matcha Vending Machine",
      tags:    ["Hardware", "Embedded Systems", "IoT"],
      summary: "Mechanical design of a refrigerated matcha vending machine for Ando Café, featuring a rotating coil dispenser, elevator delivery, and integrated cooling hookups.",
      details: "Designed mechanical system with servo-driven dispensing. Integrated payment terminal, temperature control, and remote monitoring via WiFi.",
      image:   "vending_machine_thumbnail.jpg",
      link:    "https://github.com/",
    },
    {
      title:   "15-DOF Animatronic Dog Sculpture",
      tags:    ["Robotics", "Mechanical Design", "Control Systems"],
      summary: "Interactive sculptural installation featuring 15 degrees of freedom with synchronized servo control and gesture recognition.",
      details: "",
      image:   "animatronic_dog_thumbnail.jpg",
      link:    "https://github.com/",
    },
    {
      title:   "Low-Power Sensor Node",
      tags:    ["PCB", "Embedded", "BLE"],
      summary: "Battery-powered environmental sensor with BLE telemetry, targeting 18-month operation on a single AA cell.",
      details: "Schematic capture and layout in KiCad. Firmware written in C using an nRF52 SoC. Power analysis with automated duty-cycle profiling.",
      link:    "",
    },
    {
      title:   "Thermal Simulation Tool",
      year:    "2023",
      tags:    ["Python", "Simulation", "FEA"],
      summary: "Command-line tool for rapid thermal steady-state and transient analysis of PCB stackups.",
      details: "Built a finite-element solver in NumPy/SciPy. Outputs heat maps and CSV data. Used to iterate PCB layouts before prototype spins.",
      link:    "https://github.com/",
    },
    {
      title:   "Motor Control Algorithm",
      year:    "2023",
      tags:    ["C", "Control Systems", "Embedded"],
      summary: "Field-oriented control (FOC) implementation for a BLDC motor with sub-1 ms current loop latency.",
      details: "Ported reference FOC algorithm to an STM32 microcontroller. Tuned PI gains with automated frequency-sweep tooling. Validated on a dynamometer.",
      link:    "",
    },
    {
      title:   "Signal Integrity Analyzer",
      year:    "2022",
      tags:    ["Python", "Hardware", "Lab"],
      summary: "Desktop app for automated oscilloscope capture, eye-diagram generation, and jitter decomposition.",
      details: "Instrument control via PyVISA over USB-TMC. Reports jitter budget and flags violations against a configurable mask. Used in a production test workflow.",
      link:    "https://github.com/",
    },
  ],
};
