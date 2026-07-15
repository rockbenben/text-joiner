"use client";

import React from "react";
import { MergeCellsOutlined } from "@ant-design/icons";
import TextJoiner from "./TextJoiner";
import { useTranslations } from "next-intl";
import ToolPage from "@/app/components/styled/ToolPage";

const ClientPage = () => {
  const t = useTranslations("TextJoiner");

  return (
    <ToolPage icon={<MergeCellsOutlined />} toolKey="textJoiner" description={t("clientDescription")}>
      <TextJoiner />
    </ToolPage>
  );
};

export default ClientPage;
