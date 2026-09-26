import React, { useState } from "react";

import Borders from "@dynatrace/strato-design-tokens/borders";
import Colors from "@dynatrace/strato-design-tokens/colors";
import { Button } from "@dynatrace/strato-components/buttons";
import { Flex } from "@dynatrace/strato-components/layouts";
import { FormField, Label, Radio, RadioGroup, TextInput } from "@dynatrace/strato-components/forms";
import { showToast } from "@dynatrace/strato-components/notifications";
import {
  ExternalLink,
  Heading,
  List,
  Paragraph,
  Strong,
  Text,
} from "@dynatrace/strato-components/typography";

import { DEFAULT_BRIDGE_URL, getBridgeUrl, setBridgeUrl } from "../ai/ollamaBridge";
import type { DataMode } from "../ai/redact";
import { useAiSettings } from "../ai/settings";

const BRIDGE_README = "https://github.com/rdlook04/ArchorKube/tree/master/tools/ollama-bridge";

const Section = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      padding: 20,
      background: Colors.Background.Container.Neutral.Default,
      border: `1px solid ${Colors.Border.Neutral.Default}`,
      borderRadius: Borders.Radius.Container.Default,
    }}
  >
    <Flex flexDirection="column" gap={12}>
      {children}
    </Flex>
  </div>
);

const Hint = ({ children }: { children: React.ReactNode }) => (
  <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
    {children}
  </Text>
);

export const Settings = () => {
  const { settings, loaded, save } = useAiSettings();
  const [bridgeUrl, setBridgeUrlDraft] = useState(getBridgeUrl);

  const changeMode = (value: string) => {
    const dataMode: DataMode = value === "real" ? "real" : "placeholders";
    save({ ...settings, dataMode })
      .then(() => showToast({ title: "Saved", type: "success", lifespan: 2500 }))
      .catch(() =>
        showToast({
          title: "Could not save the setting",
          message: "Placeholders stay on until it can be saved.",
          type: "critical",
          lifespan: 5000,
        }),
      );
  };

  const saveBridgeUrl = () => {
    if (!setBridgeUrl(bridgeUrl)) {
      showToast({ title: "That is not an http(s) URL", type: "critical", lifespan: 4000 });
      return;
    }
    setBridgeUrlDraft(getBridgeUrl());
    showToast({ title: "Bridge URL saved in this browser", type: "success", lifespan: 2500 });
  };

  return (
    <Flex flexDirection="column" gap={24} padding={32} style={{ maxWidth: 820 }}>
      <Heading level={1}>Settings</Heading>

      <Section>
        <Heading level={2}>Sending to AI</Heading>
        <Paragraph>
          <Strong>Dynatrace Assist</Strong> always gets the full finding: it runs inside your
          tenant. Every AI outside Dynatrace (your local Ollama, or Claude, Gemini, ChatGPT and
          others through the clipboard) gets the finding through a data filter first, and you see a
          preview of exactly what leaves before it does.
        </Paragraph>

        <FormField>
          <Label>How Kubernetes names leave Dynatrace</Label>
          <RadioGroup
            name="data-mode"
            value={settings.dataMode}
            onChange={changeMode}
            disabled={!loaded}
          >
            <Radio value="placeholders">
              <Flex flexDirection="column" gap={2}>
                <Text>Placeholders (recommended)</Text>
                <Hint>
                  Names go out as $NS, $WL, $POD, $CONTAINER. The AI writes commands with those
                  variables and you fill them in your terminal.
                </Hint>
              </Flex>
            </Radio>
            <Radio value="real">
              <Flex flexDirection="column" gap={2}>
                <Text>Real Kubernetes names</Text>
                <Hint>
                  Namespace, workload, pod and container go out as they are. The preview warns you
                  every time.
                </Hint>
              </Flex>
            </Radio>
          </RadioGroup>
        </FormField>

        <div
          style={{
            padding: 12,
            background: Colors.Background.Container.Primary.Default,
            borderRadius: Borders.Radius.Container.Default,
          }}
        >
          <Text textStyle="base-emphasized">Never leaves, in either mode</Text>
          <List>
            <Text>The cluster name (sent as &lt;kube-context&gt;)</Text>
            <Text>Squad, tribe and app code</Text>
            <Text>Costs in USD</Text>
            <Text>Tenant URLs and entity IDs</Text>
            <Text>IP addresses and emails found in log messages</Text>
          </List>
        </div>
        <Hint>Saved for your user in this tenant. Nobody else sees it.</Hint>
      </Section>

      <Section>
        <Heading level={2}>Local Ollama bridge</Heading>
        <Paragraph>
          Dynatrace apps can&apos;t connect to your machine, so ArchorKube opens a small page that
          runs locally and talks to Ollama for you.{" "}
          <ExternalLink href={BRIDGE_README}>How to start it</ExternalLink>
        </Paragraph>
        <FormField>
          <Label>Bridge URL</Label>
          <Flex gap={8}>
            <TextInput
              value={bridgeUrl}
              onChange={setBridgeUrlDraft}
              placeholder={DEFAULT_BRIDGE_URL}
              style={{ flex: 1 }}
            />
            <Button variant="emphasized" onClick={saveBridgeUrl}>
              Save
            </Button>
          </Flex>
        </FormField>
        <Hint>Stored only in this browser. Leave it empty to use {DEFAULT_BRIDGE_URL}.</Hint>
      </Section>
    </Flex>
  );
};
