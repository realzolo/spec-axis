'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal, Button } from '@heroui/react';
import { useOverlayState } from '@heroui/react';
import { AlertCircle } from 'lucide-react';

export default function OnboardingCheck() {
  const router = useRouter();
  const [needsSetup, setNeedsSetup] = useState(false);
  const [checking, setChecking] = useState(true);

  const modalState = useOverlayState({
    isOpen: needsSetup,
    onOpenChange: (isOpen) => {
      if (!isOpen) {
        // User cannot close the modal - they must configure integrations
        setNeedsSetup(true);
      }
    },
  });

  useEffect(() => {
    checkIntegrations();
  }, []);

  async function checkIntegrations() {
    try {
      const [vcsRes, aiRes] = await Promise.all([
        fetch('/api/integrations?type=vcs'),
        fetch('/api/integrations?type=ai'),
      ]);

      if (!vcsRes.ok || !aiRes.ok) {
        setChecking(false);
        return;
      }

      const vcsIntegrations = await vcsRes.json();
      const aiIntegrations = await aiRes.json();

      // Check if user has at least one integration of each type
      const hasVCS = vcsIntegrations.length > 0;
      const hasAI = aiIntegrations.length > 0;

      if (!hasVCS || !hasAI) {
        setNeedsSetup(true);
      }
    } catch (error) {
      console.error('Failed to check integrations:', error);
    } finally {
      setChecking(false);
    }
  }

  function handleGoToSettings() {
    router.push('/settings/integrations');
  }

  if (checking || !needsSetup) {
    return null;
  }

  return (
    <Modal state={modalState}>
      <Modal.Backdrop>
        <Modal.Container size="md">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>Welcome to Spec-Axis!</Modal.Heading>
            </Modal.Header>

            <Modal.Body>
              <div className="flex flex-col gap-4">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-warning/10 border border-warning/20">
                  <AlertCircle className="size-5 text-warning shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-warning mb-1">Setup Required</p>
                    <p className="text-muted-foreground">
                      Before you can start analyzing code, you need to configure:
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pl-8">
                  <div>
                    <h4 className="text-sm font-medium mb-1">1. Code Repository Integration</h4>
                    <p className="text-sm text-muted-foreground">
                      Connect to GitHub, GitLab, or another Git service to access your repositories.
                    </p>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium mb-1">2. AI Model Integration</h4>
                    <p className="text-sm text-muted-foreground">
                      Connect to Claude, GPT-4, or another AI service to enable code analysis.
                    </p>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">
                  This is a one-time setup. You can add multiple integrations and switch between them
                  later.
                </p>
              </div>
            </Modal.Body>

            <Modal.Footer>
              <Button onClick={handleGoToSettings} variant="primary" className="w-full">
                Configure Integrations
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
