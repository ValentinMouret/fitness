import { Flex, Heading } from "@radix-ui/themes";
import type React from "react";

export interface SectionHeaderProps {
  title: React.ReactNode;
  right?: React.ReactNode;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  right,
}) => {
  return (
    <Flex justify="between" align="center" mb="4">
      <Heading size="5">{title}</Heading>
      {right}
    </Flex>
  );
};
