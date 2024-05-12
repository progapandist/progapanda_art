class WorksController < ApplicationController
  before_action :authenticate, only: [:show, :index]

  def index
    @work = random_work
  end

  def show
    @work = Work.find_by(slug: params[:slug]) || random_work

    if @work.slug == params[:prev_slug]
      @work = Work.without_slugs([@work.slug]).merge(Work.order(Arel.sql("RANDOM()"))).first
    end

    if current_user
      current_user.views << @work.slug
    end

    @slug = @work&.slug.presence || ""
    @description = @work&.description.presence || ""
  end

  private

  def current_user
    Current.user
  end

  def authenticate
    user_repo = UserRepository.instance
    Current.user = user_repo.find(params[:session_id]) || user_repo.create(SecureRandom.hex(8))
  end

  def random_work
    if current_user
      without_seen_slugs = Work.without_slugs(current_user.views)
      if without_seen_slugs.empty?
        current_user.views.clear
        Work.order(Arel.sql("RANDOM()")).first
      else
        without_seen_slugs.order(Arel.sql("RANDOM()")).first
      end

    else
      Work.order(Arel.sql("RANDOM()")).first
    end
  end
end
