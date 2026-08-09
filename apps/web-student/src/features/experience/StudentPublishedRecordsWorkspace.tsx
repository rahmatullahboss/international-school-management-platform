import type { ReactElement } from 'react';

import {
  selectStudentItems,
  type StudentConversation,
  type StudentDocument,
} from './StudentDailyWorkspace';
import './student-daily-workspace.css';

export type StudentPublishedRecordsView = 'documents' | 'messages';

export interface StudentPublishedRecordsWorkspaceProps {
  readonly view: StudentPublishedRecordsView;
  readonly studentId: string;
  readonly locale: string;
  readonly capabilities: readonly string[];
  readonly documents: readonly StudentDocument[];
  readonly conversations: readonly StudentConversation[];
}

function formatDateTime(locale: string, value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}

function DocumentsView(
  props: Omit<StudentPublishedRecordsWorkspaceProps, 'view'>,
): ReactElement {
  const scopedDocuments = selectStudentItems(
    props.documents,
    props.studentId,
    props.capabilities,
  );
  const documents = scopedDocuments
    .filter((document) => document.publicationState !== 'unpublished')
    .sort((left, right) => {
      const rightPublishedAt = right.publishedAt ?? '';
      const leftPublishedAt = left.publishedAt ?? '';
      return rightPublishedAt.localeCompare(leftPublishedAt);
    });

  return (
    <section
      className="student-workspace__section"
      aria-labelledby="student-documents-heading"
    >
      <header>
        <h2 id="student-documents-heading">My documents</h2>
        <p>Only published documents authorised for your student profile are available.</p>
      </header>
      {documents.length === 0 ? (
        <div className="student-workspace__empty" role="status">
          <strong>No authorised documents</strong>
          <span>No published document is available in your current scope.</span>
        </div>
      ) : (
        <ol className="student-workspace__tasks">
          {documents.map((document) => (
            <li key={document.id} data-publication={document.publicationState}>
              <div>
                <strong>{document.title}</strong>
                <span>{document.category}</span>
                <small>{document.publicationState}</small>
                {document.publishedAt === undefined ? null : (
                  <time dateTime={document.publishedAt}>
                    Published {formatDateTime(props.locale, document.publishedAt)}
                  </time>
                )}
              </div>
              <a href={document.downloadHref}>Download authorised copy</a>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function MessagesView(
  props: Omit<StudentPublishedRecordsWorkspaceProps, 'view'>,
): ReactElement {
  const conversations = selectStudentItems(
    props.conversations,
    props.studentId,
    props.capabilities,
  ).sort((left, right) => {
    const rightUnread = Number(right.unreadCount > 0);
    const leftUnread = Number(left.unreadCount > 0);
    const unreadDifference = rightUnread - leftUnread;
    if (unreadDifference !== 0) return unreadDifference;
    return right.lastMessageAt.localeCompare(left.lastMessageAt);
  });

  return (
    <section
      className="student-workspace__section"
      aria-labelledby="student-messages-heading"
    >
      <header>
        <h2 id="student-messages-heading">My messages</h2>
        <p>Only secure conversations authorised for your student role are shown.</p>
      </header>
      {conversations.length === 0 ? (
        <div className="student-workspace__empty" role="status">
          <strong>No authorised messages</strong>
          <span>No secure message thread is available in your current scope.</span>
        </div>
      ) : (
        <ol className="student-workspace__messages">
          {conversations.map((conversation) => (
            <li key={conversation.id}>
              <div>
                <strong>{conversation.subject}</strong>
                <span>{conversation.participantLabel}</span>
                <time dateTime={conversation.lastMessageAt}>
                  {formatDateTime(props.locale, conversation.lastMessageAt)}
                </time>
              </div>
              {conversation.unreadCount === 0 ? null : (
                <span className="student-workspace__unread">
                  {new Intl.NumberFormat(props.locale).format(conversation.unreadCount)} unread
                </span>
              )}
              <a href={conversation.href}>Open conversation</a>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function StudentPublishedRecordsWorkspace(
  props: StudentPublishedRecordsWorkspaceProps,
): ReactElement {
  const sharedProps = {
    studentId: props.studentId,
    locale: props.locale,
    capabilities: props.capabilities,
    documents: props.documents,
    conversations: props.conversations,
  };

  return (
    <div className="student-workspace" data-route-workspace={props.view}>
      {props.view === 'documents' ? (
        <DocumentsView {...sharedProps} />
      ) : (
        <MessagesView {...sharedProps} />
      )}
    </div>
  );
}
