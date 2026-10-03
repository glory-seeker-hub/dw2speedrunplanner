import { UserGuide } from './help/UserGuide';
import { Info, ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import glorySeekerImage from '@/assets/glory-seeker.jpg';

export const InfoDialog = () => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" aria-label="About this application" className="h-10 w-10">
          <Info className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100%-1rem)] max-w-3xl max-h-[85dvh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-2xl">About This Application</DialogTitle>
          <DialogDescription>
            User guide for the Run Planner and Battle Simulator
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="how-to" className="w-full">
          <TabsList className="grid h-auto w-full grid-cols-3">
            <TabsTrigger className="min-h-11 whitespace-normal text-center" value="how-to">How to Use</TabsTrigger>
            <TabsTrigger className="min-h-11 whitespace-normal text-center" value="mechanics">Battle Mechanics</TabsTrigger>
            <TabsTrigger className="min-h-11 whitespace-normal text-center" value="credits">Credits</TabsTrigger>
          </TabsList>

          <TabsContent value="how-to"><UserGuide /></TabsContent>
          <TabsContent value="mechanics" className="space-y-4">
            <Card><CardContent className="space-y-3 pt-6 text-sm">
              <h3 className="font-semibold">Supported battle model</h3>
              <p>The Simulator models action timing, initiative, MP, supported status effects, Counter, Interrupt and Assist/support behavior. Availability depends on the technique and modeled effect; inspect action details and effect diagnostics for a specific execution.</p>
              <p>Accuracy Mode controls ordinary Hit Rate. RNG Policy separately controls supported status outcomes. See Accuracy and RNG and TAS Luck in How to Use for the supported scope.</p>
              <p>Reported frames cover modeled battle actions, excluding external menu/order-entry overhead. The model and bounded search do not establish an exact real-game optimum.</p>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="credits" className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center space-y-4">
                  <div className="relative w-48 h-auto rounded-lg overflow-hidden shadow-lg">
                    <img 
                      src={glorySeekerImage} 
                      alt="Glory Seeker" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="text-center space-y-2">
                    <h3 className="text-xl font-bold">Created by GlorySeeker</h3>
                    <p className="text-sm text-muted-foreground">
                      Digimon World 2 enthusiast and content creator
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Unofficial fan-made tool. Not affiliated with or endorsed by Bandai, Toei Animation, or the rights holders of Digimon.
                    </p>
                    <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm">
                      <a href="https://github.com/glory-seeker-hub/dw2speedrunplanner" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">Source on GitHub</a>
                      <a href="https://github.com/glory-seeker-hub/dw2speedrunplanner/issues" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">Report an issue</a>
                    </div>
                    <a
                      href="https://www.twitch.tv/glory_seeker"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-primary hover:underline"
                    >
                      <ExternalLink className="h-4 w-4" />
                      twitch.tv/glory_seeker
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
