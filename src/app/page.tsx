'use client';

import {
  Button,
  Card,
  Input,
  Chip,
  Switch,
  Avatar,
  Separator,
  Spinner,
} from '@heroui/react';
import { useState } from 'react';

export default function Home() {
  const [checked, setChecked] = useState(false);

  return (
    <main className="min-h-screen p-8 bg-background">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">HeroUI v3 组件验证</h1>
          <p className="text-muted-foreground">验证 HeroUI v3 + Tailwind v4 是否正常工作</p>
        </div>

        <Separator />

        {/* Buttons */}
        <Card>
          <Card.Header>
            <Card.Title>Button 按钮</Card.Title>
          </Card.Header>
          <Card.Content className="flex flex-row flex-wrap gap-3">
            <Button>Default</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="tertiary">Tertiary</Button>
            <Button variant="danger">Danger</Button>
            <Button isDisabled>Disabled</Button>
          </Card.Content>
        </Card>

        {/* Input */}
        <Card>
          <Card.Header>
            <Card.Title>Input 输入框</Card.Title>
          </Card.Header>
          <Card.Content className="space-y-3">
            <Input placeholder="默认输入框" />
            <Input placeholder="Secondary 变体" variant="secondary" />
            <Input placeholder="禁用状态" disabled />
          </Card.Content>
        </Card>

        {/* Chip */}
        <Card>
          <Card.Header>
            <Card.Title>Chip 标签</Card.Title>
          </Card.Header>
          <Card.Content className="flex flex-row flex-wrap gap-3">
            <Chip>Default</Chip>
            <Chip variant="secondary">Secondary</Chip>
            <Chip variant="soft">Soft</Chip>
            <Chip variant="tertiary">Tertiary</Chip>
            <Chip color="success">Success</Chip>
            <Chip color="warning">Warning</Chip>
            <Chip color="danger">Danger</Chip>
          </Card.Content>
        </Card>

        {/* Switch */}
        <Card>
          <Card.Header>
            <Card.Title>Switch 开关</Card.Title>
          </Card.Header>
          <Card.Content className="flex flex-col gap-3">
            <Switch isSelected={checked} onChange={setChecked}>
              {checked ? '已开启' : '已关闭'}
            </Switch>
            <Switch defaultSelected>默认开启</Switch>
            <Switch isDisabled>禁用状态</Switch>
          </Card.Content>
        </Card>

        {/* Avatar */}
        <Card>
          <Card.Header>
            <Card.Title>Avatar 头像</Card.Title>
          </Card.Header>
          <Card.Content className="flex flex-row gap-4 items-center">
            <Avatar>
              <Avatar.Fallback>张</Avatar.Fallback>
            </Avatar>
            <Avatar size="lg">
              <Avatar.Fallback>李</Avatar.Fallback>
            </Avatar>
            <Avatar size="sm">
              <Avatar.Image src="https://i.pravatar.cc/150?u=1" />
              <Avatar.Fallback>王</Avatar.Fallback>
            </Avatar>
          </Card.Content>
        </Card>

        {/* Spinner */}
        <Card>
          <Card.Header>
            <Card.Title>Spinner 加载</Card.Title>
          </Card.Header>
          <Card.Content className="flex flex-row gap-6 items-center">
            <Spinner size="sm" />
            <Spinner />
            <Spinner size="lg" />
          </Card.Content>
        </Card>

        <div className="text-center text-muted-foreground text-sm pb-8">
          ✅ HeroUI v3 组件库验证完成
        </div>
      </div>
    </main>
  );
}
