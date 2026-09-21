"use client";

import { Subtitle } from "@tremor/react";
import { LinkWithIcon } from "components/LinkWithIcon";
import { Disclosure } from "@headlessui/react";
import { IoChevronUp } from "react-icons/io5";
import { IconType } from "react-icons/lib";
import clsx from "clsx";
import { IoMdGitMerge } from "react-icons/io";
import { TbTopologyRing, TbTimeline, TbChartDots3 } from "react-icons/tb";
import { LuWorkflow, LuGauge, LuBrainCircuit } from "react-icons/lu";
import { VscDebugDisconnect } from "react-icons/vsc";
import {
  AiOutlineAlert,
  AiOutlineFire,
  AiOutlineGroup,
  AiOutlineHome,
} from "react-icons/ai";
import {
  MdOutlineNotificationsActive,
  MdOutlineRuleFolder,
  MdOutlineEventBusy,
} from "react-icons/md";
import {
  HiOutlineCog6Tooth,
  HiOutlineSparkles,
  HiOutlineShieldCheck,
} from "react-icons/hi2";

type NavLink = {
  href: string;
  label: string;
  icon: IconType;
  testId: string;
  isExact?: boolean;
  isDemo?: boolean;
};

type NavSection = {
  title: string;
  links: NavLink[];
};

// Header-less group at the top: Overview + the alert feed.
const TOP_LINKS: NavLink[] = [
  { href: "/", label: "Overview", icon: AiOutlineHome, testId: "home", isExact: true },
  { href: "/feed", label: "Alert Feed", icon: AiOutlineAlert, testId: "feed" },
];

// `isDemo` marks surfaces backed by sample data rather than the AlertLens API.
const SECTIONS: NavSection[] = [
  {
    title: "INCIDENTS",
    links: [
      { href: "/incidents", label: "Incidents", icon: MdOutlineNotificationsActive, testId: "incidents" },
      { href: "/review", label: "Review Queue", icon: HiOutlineShieldCheck, testId: "review" },
      { href: "/timemachine", label: "Time Machine", icon: TbTimeline, testId: "timemachine" },
    ],
  },
  {
    title: "INTELLIGENCE",
    links: [
      { href: "/correlations", label: "Correlations", icon: TbChartDots3, testId: "correlations" },
      { href: "/deduplication", label: "Deduplication", icon: IoMdGitMerge, testId: "deduplication" },
      { href: "/topology", label: "Service Topology", icon: TbTopologyRing, testId: "topology" },
      { href: "/forecast", label: "Forecast", icon: LuGauge, testId: "forecast" },
    ],
  },
  {
    title: "CONFIGURATION",
    links: [
      { href: "/maintenance", label: "Maintenance", icon: MdOutlineEventBusy, testId: "maintenance" },
      { href: "/settings", label: "Settings", icon: HiOutlineCog6Tooth, testId: "settings" },
    ],
  },
  {
    title: "INSIGHTS",
    links: [
      { href: "/evaluation", label: "Evaluation", icon: LuBrainCircuit, testId: "evaluation" },
      { href: "/pipeline", label: "Pipeline", icon: LuWorkflow, testId: "pipeline" },
    ],
  },
];

const NavGroup = ({ title, links }: NavSection) => (
  <Disclosure as="div" className="space-y-0.5" defaultOpen>
    <Disclosure.Button className="w-full flex justify-between items-center px-2">
      {({ open }) => (
        <>
          <Subtitle className="text-[10.5px] ml-2 text-gray-400 font-semibold uppercase tracking-wider">
            {title}
          </Subtitle>
          <IoChevronUp
            className={clsx({ "rotate-180": open }, "mr-2 text-gray-300 w-3 h-3")}
          />
        </>
      )}
    </Disclosure.Button>
    <Disclosure.Panel as="ul" className="space-y-0.5 p-1 pr-1">
      {links.map((link) => (
        <li key={link.href}>
          <LinkWithIcon
            href={link.href}
            icon={link.icon}
            testId={link.testId}
            isExact={link.isExact}
            isBeta={link.isDemo}
          >
            <Subtitle className="text-xs">{link.label}</Subtitle>
          </LinkWithIcon>
        </li>
      ))}
    </Disclosure.Panel>
  </Disclosure>
);

export const AlertLensLinks = () => (
  <>
    <ul className="space-y-0.5 p-1 pr-1">
      {TOP_LINKS.map((link) => (
        <li key={link.href}>
          <LinkWithIcon href={link.href} icon={link.icon} testId={link.testId} isExact={link.isExact}>
            <Subtitle className="text-xs">{link.label}</Subtitle>
          </LinkWithIcon>
        </li>
      ))}
    </ul>
    {SECTIONS.map((section) => (
      <NavGroup key={section.title} {...section} />
    ))}
  </>
);
