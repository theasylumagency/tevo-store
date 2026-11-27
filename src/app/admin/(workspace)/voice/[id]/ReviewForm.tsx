"use client";

import { useActionState, useState } from "react";
import { reviewVoiceAction } from "@/app/actions/voice";
import { button, field, primary } from "../../catalog/styles";

export function ReviewForm({ id, run, revision, page, initial, flagged, admin }: {
  id: number; run: string; revision: number; page: number; initial: string; flagged: boolean; admin: boolean;
}) {
  const [text, setText] = useState(initial);
  const [error, action, pending] = useActionState(reviewVoiceAction, null);
  return <form action={action} className="space-y-2">
    <input type="hidden" name="run" value={run}/><input type="hidden" name="item" value={id}/>
    <input type="hidden" name="revision" value={revision}/><input type="hidden" name="page" value={page}/>
    <label className="block text-sm">განხილული ტექსტი<textarea name="description" value={text} onChange={e => setText(e.target.value)}
      rows={4} maxLength={7200} className={field}/></label>
    {admin && flagged && <label className="flex gap-2 text-sm"><input type="checkbox" name="ack"/>მონიშნული საკითხები წყაროსთან გადავამოწმე</label>}
    {error && <p role="alert" className="text-warn">{error}</p>}
    <div className="flex flex-wrap gap-2"><button disabled={pending} name="intent" value="save" className={button}>შესწორების შენახვა</button>
      {admin && <button disabled={pending} name="intent" value="approve" className={primary}>აღწერის დამტკიცება</button>}
      <button disabled={pending} name="intent" value="reject" className={button}>უარყოფა</button></div>
  </form>;
}
